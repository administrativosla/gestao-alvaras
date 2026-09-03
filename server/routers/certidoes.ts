import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addCertidaoVersao,
  createCertidaoConsulta,
  getCertidaoConsultaById,
  getClienteById,
  listCertidaoConsultas,
  listCertidaoVersoes,
  updateCertidaoConsulta,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import {
  detectarTipoArquivoCertidao,
  nomeArquivoSeguro,
  RECEITA_CERTIDOES_URL,
  RESULTADOS_CERTIDAO,
  statusFinalDoResultado,
  TIPOS_ARQUIVO_CERTIDAO,
} from "../../shared/certidoes";

const origemSchema = z.enum(["consulta_anterior", "nova_emissao_assistida"]);
const resultadoSchema = z.enum(RESULTADOS_CERTIDAO);
const resultadoFinalSchema = resultadoSchema.refine((resultado) => resultado !== "nao_classificado", "Selecione o resultado da consulta.");
const mimeSchema = z.enum(TIPOS_ARQUIVO_CERTIDAO);
const LIMITE_ARQUIVO_BYTES = 10 * 1024 * 1024;
const LIMITE_BASE64 = Math.ceil(LIMITE_ARQUIVO_BYTES * 4 / 3) + 100;

function nomeOperador(user: { id: number; name?: string | null; email?: string | null }) {
  return user.name?.trim() || user.email?.trim() || `Usuário #${user.id}`;
}

export const certidoesRouter = router({
  list: protectedProcedure
    .input(z.object({ clienteId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(500).optional() }).optional())
    .query(async ({ input }) => {
      const consultas = await listCertidaoConsultas({
        clienteId: input?.clienteId,
        fonte: "receita_federal",
        limit: input?.limit,
      });
      return Promise.all(consultas.map(async (item) => ({
        ...item,
        versoes: await listCertidaoVersoes(item.consulta.id),
      })));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const consulta = await getCertidaoConsultaById(input.id);
      if (!consulta) throw new TRPCError({ code: "NOT_FOUND", message: "Consulta não encontrada." });
      return { consulta, versoes: await listCertidaoVersoes(input.id) };
    }),

  iniciar: protectedProcedure
    .input(z.object({ clienteId: z.number().int().positive(), origem: origemSchema.default("consulta_anterior") }))
    .mutation(async ({ input, ctx }) => {
      const cliente = await getClienteById(input.clienteId);
      if (!cliente || !cliente.ativo) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });

      const id = await createCertidaoConsulta({
        clienteId: cliente.id,
        fonte: "receita_federal",
        origem: input.origem,
        status: input.origem === "consulta_anterior" ? "iniciada" : "aguardando_registro",
        resultado: "nao_classificado",
        urlFonte: RECEITA_CERTIDOES_URL,
        operadorId: ctx.user.id,
        operadorNome: nomeOperador(ctx.user),
      });

      return { id, cnpj: cliente.cnpj, urlFonte: RECEITA_CERTIDOES_URL, origem: input.origem };
    }),

  registrarResultado: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      resultado: resultadoFinalSchema,
      mensagemCapturada: z.string().trim().max(10000).optional(),
      observacoes: z.string().trim().max(5000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const consulta = await getCertidaoConsultaById(input.id);
      if (!consulta) throw new TRPCError({ code: "NOT_FOUND", message: "Consulta não encontrada." });
      if (["concluida", "indisponivel", "erro"].includes(consulta.status)) {
        throw new TRPCError({ code: "CONFLICT", message: "Esta consulta já foi finalizada. Inicie uma nova tentativa para preservar o histórico." });
      }

      await updateCertidaoConsulta(input.id, {
        status: statusFinalDoResultado(input.resultado),
        resultado: input.resultado,
        mensagemCapturada: input.mensagemCapturada || null,
        observacoes: input.observacoes || null,
        finalizadoPorId: ctx.user.id,
        finalizadoPorNome: nomeOperador(ctx.user),
        finalizadoEm: new Date(),
      });

      if (input.mensagemCapturada) {
        await addCertidaoVersao({
          consultaId: consulta.id,
          clienteId: consulta.clienteId,
          tipo: "texto",
          textoCapturado: input.mensagemCapturada,
          capturadoPorId: ctx.user.id,
          capturadoPorNome: nomeOperador(ctx.user),
        });
      }

      return { success: true } as const;
    }),

  anexarVersao: protectedProcedure
    .input(z.object({
      consultaId: z.number().int().positive(),
      fileBase64: z.string().min(1).max(LIMITE_BASE64),
      fileName: z.string().trim().min(1).max(500),
      mimeType: mimeSchema,
      validadeAte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const consulta = await getCertidaoConsultaById(input.consultaId);
      if (!consulta) throw new TRPCError({ code: "NOT_FOUND", message: "Consulta não encontrada." });

      const base64 = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length === 0 || bytes.length > LIMITE_ARQUIVO_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O arquivo deve ter no máximo 10 MB." });
      }
      const tipo = detectarTipoArquivoCertidao(bytes, input.mimeType);
      if (!tipo) throw new TRPCError({ code: "BAD_REQUEST", message: "O conteúdo do arquivo não corresponde a um PDF ou imagem permitida." });

      const fileName = nomeArquivoSeguro(input.fileName);
      const { key, url } = await storagePut(
        `certidoes/${consulta.clienteId}/${consulta.id}/${fileName}`,
        bytes,
        input.mimeType,
      );
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const versao = await addCertidaoVersao({
        consultaId: consulta.id,
        clienteId: consulta.clienteId,
        tipo,
        fileName,
        fileKey: key,
        fileUrl: url,
        mimeType: input.mimeType,
        fileSize: bytes.length,
        sha256,
        validadeAte: input.validadeAte ? new Date(`${input.validadeAte}T12:00:00.000Z`) : undefined,
        capturadoPorId: ctx.user.id,
        capturadoPorNome: nomeOperador(ctx.user),
      });

      return { ...versao, fileName, fileUrl: url, sha256 };
    }),
});
