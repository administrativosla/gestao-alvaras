import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { ROLE_LEVEL, permissoes } from "../../drizzle/schema";
import { getDb } from "../db";
import { and, eq } from "drizzle-orm";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ─── Middleware base: requer login ────────────────────────────────────────────
const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Cron tasks always pass through
  if ((ctx.user as any).isCron) {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }

  // Blocked users are always rejected
  if (ctx.user.userStatus === "blocked") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta foi bloqueada. Entre em contato com um administrador." });
  }

  // Pending users can only access auth.me and auth.logout (public procedures)
  // Protected procedures will reject pending users
  if (ctx.user.userStatus === "pending") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seu acesso está aguardando aprovação de um administrador." });
  }

  return next({
    ctx: { ...ctx, user: ctx.user },
  });
});

/** Procedure que requer usuário ativo (qualquer nível: operator, gestor, master) */
export const protectedProcedure = t.procedure.use(requireUser);

/**
 * Middleware de autorização por ação configurável na matriz de permissões.
 * Deve ser encadeado após protectedProcedure, gestorProcedure ou masterProcedure.
 */
export const requirePermissao = (modulo: string, acao: string) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    // Execuções internas agendadas não representam um usuário de negócio.
    if ((ctx.user as any).isCron) {
      return next({ ctx: { ...ctx, user: ctx.user } });
    }

    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de permissões indisponível." });
    }

    const [permissao] = await db
      .select({ permitido: permissoes.permitido })
      .from(permissoes)
      .where(
        and(
          eq(permissoes.perfil, ctx.user.role),
          eq(permissoes.modulo, modulo),
          eq(permissoes.acao, acao)
        )
      )
      .limit(1);

    if (!permissao?.permitido) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Você não tem permissão para executar esta ação.",
      });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });

// ─── Middleware de nível mínimo ───────────────────────────────────────────────
const requireLevel = (minLevel: number) =>
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if ((ctx.user as any).isCron) {
      return next({ ctx: { ...ctx, user: ctx.user } });
    }

    if (ctx.user.userStatus === "blocked") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta foi bloqueada." });
    }

    if (ctx.user.userStatus === "pending") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Seu acesso está aguardando aprovação." });
    }

    const userLevel = ROLE_LEVEL[ctx.user.role] ?? 0;
    if (userLevel < minLevel) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });

/** Procedure que requer nível 2+ (Gestor ou Master) — pode exportar */
export const gestorProcedure = t.procedure.use(requireLevel(2));

/** Procedure que requer nível 3 (Master) — acesso total */
export const masterProcedure = t.procedure.use(requireLevel(3));

/** @deprecated use masterProcedure — mantido para compatibilidade */
export const adminProcedure = masterProcedure;
