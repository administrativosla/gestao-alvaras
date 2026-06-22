import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { parseDate } from "../utils/parseDate";
import {
  createCliente,
  deleteCliente,
  getClienteByCnpj,
  getClienteById,
  getEmailsAlerta,
  listClientes,
  setEmailsAlerta,
  updateCliente,
} from "../db";

const clienteSchema = z.object({
  cnpj: z.string().min(14).max(18),
  razaoSocial: z.string().min(1).max(255),
  nomeFantasia: z.string().max(255).optional().nullable(),
  inscricaoEstadual: z.string().max(50).optional().nullable(),
  inscricaoMunicipal: z.string().max(50).optional().nullable(),
  logradouro: z.string().max(255).optional().nullable(),
  numero: z.string().max(20).optional().nullable(),
  complemento: z.string().max(100).optional().nullable(),
  bairro: z.string().max(100).optional().nullable(),
  cidade: z.string().max(100).optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  cep: z.string().max(9).optional().nullable(),
  nomeContato: z.string().max(255).optional().nullable(),
  telefone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(320).optional().nullable(),
  dataAbertura: z.string().optional().nullable(),
  observacoesPreventivas: z.string().optional().nullable(),
  emailsAlerta: z.array(z.string().email()).optional(),
});

export const clientesRouter = router({
  list: publicProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return listClientes(input?.search);
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const cliente = await getClienteById(input.id);
      if (!cliente) throw new TRPCError({ code: "NOT_FOUND" });
      const emails = await getEmailsAlerta(input.id);
      return { ...cliente, emailsAlerta: emails.map((e) => e.email) };
    }),

  getByCnpj: publicProcedure
    .input(z.object({ cnpj: z.string() }))
    .query(async ({ input }) => {
      return getClienteByCnpj(input.cnpj);
    }),

  create: publicProcedure.input(clienteSchema).mutation(async ({ input, ctx }) => {
    const existing = await getClienteByCnpj(input.cnpj);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "CNPJ já cadastrado." });

    const { emailsAlerta: emails, dataAbertura, ...rest } = input;
    const id = await createCliente({
      ...rest,
      dataAbertura: parseDate(dataAbertura) ?? null,
    });

    if (emails && emails.length > 0) {
      await setEmailsAlerta(id, emails);
    }
    return { id };
  }),

  update: publicProcedure
    .input(z.object({ id: z.number(), data: clienteSchema.partial() }))
    .mutation(async ({ input }) => {
      const { emailsAlerta: emails, dataAbertura, ...rest } = input.data;
      await updateCliente(input.id, {
        ...rest,
        dataAbertura: dataAbertura !== undefined ? (parseDate(dataAbertura) ?? undefined) : undefined,
      });
      if (emails !== undefined) {
        await setEmailsAlerta(input.id, emails);
      }
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCliente(input.id);
      return { success: true };
    }),
});
