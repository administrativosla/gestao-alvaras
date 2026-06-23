import { z } from "zod";
import { masterProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, convites, ROLE_LABELS } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "../_core/notification";
import { enviarConviteUsuario } from "../services/email";
import crypto from "crypto";

export const usuariosRouter = router({
  /** Lista todos os usuários (somente master) */
  listar: masterProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        userStatus: users.userStatus,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    return rows;
  }),

  /** Aprova um usuário pendente e define seu nível (somente master) */
  aprovar: masterProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["operator", "gestor", "master"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      if (user.userStatus !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário não está pendente" });
      }

      await db
        .update(users)
        .set({ userStatus: "active", role: input.role })
        .where(eq(users.id, input.userId));

      return { ok: true, name: user.name, role: input.role };
    }),

  /** Altera o nível de um usuário ativo (somente master) */
  alterarRole: masterProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["operator", "gestor", "master"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      // Impede que o master se rebaixe
      if (input.userId === ctx.user.id && input.role !== "master") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode alterar seu próprio nível." });
      }

      await db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));

      return { ok: true };
    }),

  /** Bloqueia ou desbloqueia um usuário (somente master) */
  alterarStatus: masterProcedure
    .input(
      z.object({
        userId: z.number(),
        userStatus: z.enum(["active", "blocked"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode bloquear sua própria conta." });
      }

      await db
        .update(users)
        .set({ userStatus: input.userStatus })
        .where(eq(users.id, input.userId));

      return { ok: true };
    }),

  /** Retorna o próprio perfil do usuário logado */
  meuPerfil: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
      userStatus: ctx.user.userStatus,
      roleLabel: ROLE_LABELS[ctx.user.role],
    };
  }),

  /** Conta usuários pendentes (para badge no menu — somente master) */
  contarPendentes: masterProcedure.query(async () => {
    const db = await getDb();
    if (!db) return 0;
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.userStatus, "pending"));
    return rows.length;
  }),

  /** Envia convite por e-mail para um novo usuário (somente master) */
  convidar: masterProcedure
    .input(
      z.object({
        email: z.string().email("E-mail inválido"),
        role: z.enum(["operator", "gestor", "master"]),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      // Cancelar convites anteriores pendentes para o mesmo e-mail
      await db
        .update(convites)
        .set({ status: "cancelled" })
        .where(and(eq(convites.email, input.email), eq(convites.status, "pending")));

      // Gerar token único (não é usado na URL, apenas como referência interna)
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

      await db.insert(convites).values({
        email: input.email,
        role: input.role,
        token,
        status: "pending",
        convidadoPorId: ctx.user.id,
        expiresAt,
      });

      const convidadoPorNome = ctx.user.name ?? "Administrador";

      const ok = await enviarConviteUsuario(input.email, {
        roleLabel: ROLE_LABELS[input.role],
        linkAcesso: input.origin,
        convidadoPorNome,
        expiresAt,
      });

      return { ok, email: input.email };
    }),

  /** Lista convites enviados (somente master) */
  listarConvites: masterProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(convites)
      .orderBy(desc(convites.createdAt));
    return rows;
  }),

  /** Cancela um convite pendente (somente master) */
  cancelarConvite: masterProcedure
    .input(z.object({ conviteId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      await db
        .update(convites)
        .set({ status: "cancelled" })
        .where(and(eq(convites.id, input.conviteId), eq(convites.status, "pending")));
      return { ok: true };
    }),
});
