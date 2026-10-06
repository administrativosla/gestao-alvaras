import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { clientes, decAuditoria, decCategorias, decDestinacoes, decRecebimentos } from "../drizzle/schema";
import type { TipoDestinacaoDec } from "../shared/decTipos";
import { getDb } from "./db";

export type TipoDestino = TipoDestinacaoDec;
export type NovaDestinacaoDec = { tipo: TipoDestino; quantidade: number; clienteId?: number | null; observacao?: string | null };
type Operador = { id: number; nome: string };
const indisponivel = () => new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
const inexistente = (nome: string) => new TRPCError({ code: "NOT_FOUND", message: `${nome} não encontrado.` });
const conflito = (mensagem: string) => new TRPCError({ code: "CONFLICT", message: mensagem });
const data = (dia: string) => new Date(`${dia}T12:00:00Z`);
export function filtroPeriodoRecebimentosDec(inicio: string, fim: string) {
  // DATE no MySQL não tem hora. Usar meio-dia UTC nos limites excluía o primeiro
  // dia, apesar de a data civil do recebimento estar salva corretamente.
  return and(gte(decRecebimentos.dataRecebimento, sql`${inicio}`), lte(decRecebimentos.dataRecebimento, sql`${fim}`))!;
}
export function validarSaldoDec(total: number, jaDestinadas: number, novaQuantidade: number) {
  if (jaDestinadas + novaQuantidade > total) throw conflito(`Restam ${Math.max(0, total - jaDestinadas)} mensagens sem destinação neste lançamento.`);
}
export function validarStatusClienteDec(tipo: TipoDestino, cliente: { ativo: boolean } | null) {
  if (tipo === "redirecionada_ativo" && !cliente?.ativo) throw conflito("Para redirecionar, selecione um cliente ativo.");
  if (tipo === "arquivada_inativo" && cliente?.ativo) throw conflito("Para arquivar como inativo, selecione um cliente inativo.");
  if (tipo === "encaminhada_time_interno" && cliente) throw conflito("Encaminhamento ao time interno não pode ser vinculado a um cliente.");
  if (tipo === "redirecionada_varias" && cliente) throw conflito("Envio para várias empresas não pode ser vinculado a um cliente individual.");
}
export function somarDestinacoesDec(destinacoes: readonly { tipo: TipoDestino; quantidade: number }[]) {
  const totais = { redirecionadas: 0, varias: 0, internas: 0, semAcao: 0, inativos: 0 };
  for (const destino of destinacoes) {
    if (destino.tipo === "redirecionada_ativo") totais.redirecionadas += destino.quantidade;
    else if (destino.tipo === "redirecionada_varias") {
      totais.redirecionadas += destino.quantidade;
      totais.varias += destino.quantidade;
    }
    else if (destino.tipo === "encaminhada_time_interno") totais.internas += destino.quantidade;
    else if (destino.tipo === "arquivada_sem_acao") totais.semAcao += destino.quantidade;
    else totais.inativos += destino.quantidade;
  }
  return totais;
}
const auditor = (operador: Operador, entidade: "categoria" | "recebimento" | "destinacao", entidadeId: number, acao: string, antes: unknown, depois: unknown) => ({
  entidade, entidadeId, acao, antes: antes == null ? null : JSON.stringify(antes), depois: depois == null ? null : JSON.stringify(depois),
  operadorId: operador.id, operadorNome: operador.nome,
});

export async function listarCategoriasDec() {
  const db = await getDb(); if (!db) throw indisponivel();
  return db.select().from(decCategorias).orderBy(asc(decCategorias.nome));
}
export async function salvarCategoriaDec(input: { id?: number; nome: string; descricao?: string | null; ativa?: boolean }, operador: Operador) {
  const db = await getDb(); if (!db) throw indisponivel();
  return db.transaction(async tx => {
    const [duplicada] = await tx.select({ id: decCategorias.id }).from(decCategorias).where(eq(decCategorias.nome, input.nome)).limit(1);
    if (duplicada && duplicada.id !== input.id) throw conflito("Essa categoria já está cadastrada.");
    if (input.id) {
      const [anterior] = await tx.select().from(decCategorias).where(eq(decCategorias.id, input.id)).for("update");
      if (!anterior) throw inexistente("Categoria");
      const alteracoes = { nome: input.nome, descricao: input.descricao ?? null, ativa: input.ativa ?? anterior.ativa };
      await tx.update(decCategorias).set(alteracoes).where(eq(decCategorias.id, input.id));
      await tx.insert(decAuditoria).values(auditor(operador, "categoria", input.id, "atualizada", anterior, alteracoes));
      return { id: input.id };
    }
    const valores = { nome: input.nome, descricao: input.descricao ?? null };
    const [result] = await tx.insert(decCategorias).values(valores);
    const id = result.insertId;
    await tx.insert(decAuditoria).values(auditor(operador, "categoria", id, "criada", null, valores));
    return { id };
  });
}

export async function criarRecebimentoDec(input: { categoriaId: number; dia: string; quantidade: number; observacao?: string | null; destinacoes?: NovaDestinacaoDec[] }, operador: Operador) {
  const db = await getDb(); if (!db) throw indisponivel();
  return db.transaction(async tx => {
    const [categoria] = await tx.select().from(decCategorias).where(eq(decCategorias.id, input.categoriaId)).limit(1);
    if (!categoria?.ativa) throw conflito("Selecione uma categoria ativa.");
    const classificadas = (input.destinacoes ?? []).reduce((total, destino) => total + destino.quantidade, 0);
    validarSaldoDec(input.quantidade, 0, classificadas);
    // Confere todos os vínculos antes de gravar o lote; qualquer erro reverte a transação inteira.
    const destinos = [];
    for (const destino of input.destinacoes ?? []) {
      const cliente = await validarCliente(tx, destino.tipo, destino.clienteId);
      destinos.push({ ...destino, clienteId: cliente?.id ?? null, clienteNome: cliente?.razaoSocial ?? null });
    }
    const valores = { categoriaId: input.categoriaId, dataRecebimento: data(input.dia), quantidade: input.quantidade, observacao: input.observacao ?? null, operadorId: operador.id, operadorNome: operador.nome };
    const [result] = await tx.insert(decRecebimentos).values(valores);
    await tx.insert(decAuditoria).values(auditor(operador, "recebimento", result.insertId, "criado", null, valores));
    for (const destino of destinos) {
      const valorDestino = { ...destino, observacao: destino.observacao ?? null, recebimentoId: result.insertId, operadorId: operador.id, operadorNome: operador.nome };
      const [destinoResult] = await tx.insert(decDestinacoes).values(valorDestino);
      await tx.insert(decAuditoria).values(auditor(operador, "destinacao", destinoResult.insertId, "criada", null, valorDestino));
    }
    return { id: result.insertId };
  });
}

export async function corrigirRecebimentoDec(input: { id: number; quantidade: number; observacao?: string | null }, operador: Operador) {
  const db = await getDb(); if (!db) throw indisponivel();
  return db.transaction(async tx => {
    const [anterior] = await tx.select().from(decRecebimentos).where(eq(decRecebimentos.id, input.id)).for("update");
    if (!anterior) throw inexistente("Lançamento");
    const vinculadas = await tx.select({ quantidade: decDestinacoes.quantidade }).from(decDestinacoes).where(eq(decDestinacoes.recebimentoId, input.id));
    const alocadas = vinculadas.reduce((n, item) => n + item.quantidade, 0);
    if (input.quantidade < alocadas) throw conflito(`Já existem ${alocadas} mensagens destinadas. Corrija as destinações antes de reduzir o total.`);
    const alteracoes = { quantidade: input.quantidade, observacao: input.observacao ?? null };
    await tx.update(decRecebimentos).set(alteracoes).where(eq(decRecebimentos.id, input.id));
    await tx.insert(decAuditoria).values(auditor(operador, "recebimento", input.id, "corrigido", anterior, alteracoes));
    return { id: input.id };
  });
}

async function validarCliente(tx: any, tipo: TipoDestino, clienteId?: number | null) {
  if (tipo === "redirecionada_ativo" && !clienteId) throw conflito("Indique o cliente ativo que recebeu a mensagem.");
  if (tipo === "encaminhada_time_interno" && clienteId) throw conflito("Encaminhamento ao time interno não pode ser vinculado a um cliente.");
  if (tipo === "redirecionada_varias" && clienteId) throw conflito("Envio para várias empresas não pode ser vinculado a um cliente individual.");
  if (!clienteId) return null;
  const [cliente] = await tx.select().from(clientes).where(eq(clientes.id, clienteId)).limit(1);
  if (!cliente) throw inexistente("Cliente");
  validarStatusClienteDec(tipo, cliente);
  return cliente;
}

export async function salvarDestinacaoDec(input: { id?: number; recebimentoId: number; tipo: TipoDestino; quantidade: number; clienteId?: number | null; observacao?: string | null }, operador: Operador) {
  const db = await getDb(); if (!db) throw indisponivel();
  return db.transaction(async tx => {
    // Trava o recebimento para serializar correções e destinações concorrentes.
    const [recebimento] = await tx.select().from(decRecebimentos).where(eq(decRecebimentos.id, input.recebimentoId)).for("update");
    if (!recebimento) throw inexistente("Lançamento");
    const [anterior] = input.id ? await tx.select().from(decDestinacoes).where(eq(decDestinacoes.id, input.id)).for("update") : [];
    if (input.id && (!anterior || anterior.recebimentoId !== input.recebimentoId || !anterior.quantidade)) throw inexistente("Destinação");
    const cliente = await validarCliente(tx, input.tipo, input.clienteId);
    const vinculadas = await tx.select({ id: decDestinacoes.id, quantidade: decDestinacoes.quantidade }).from(decDestinacoes).where(eq(decDestinacoes.recebimentoId, input.recebimentoId));
    const outras = vinculadas.reduce((n, item) => n + (item.id === input.id ? 0 : item.quantidade), 0);
    validarSaldoDec(recebimento.quantidade, outras, input.quantidade);
    const valores = { tipo: input.tipo, quantidade: input.quantidade, clienteId: cliente?.id ?? null, clienteNome: cliente?.razaoSocial ?? null, observacao: input.observacao ?? null, operadorId: operador.id, operadorNome: operador.nome };
    if (input.id) {
      await tx.update(decDestinacoes).set(valores).where(eq(decDestinacoes.id, input.id));
      await tx.insert(decAuditoria).values(auditor(operador, "destinacao", input.id, "corrigida", anterior, valores));
      return { id: input.id };
    }
    const [result] = await tx.insert(decDestinacoes).values({ ...valores, recebimentoId: input.recebimentoId });
    await tx.insert(decAuditoria).values(auditor(operador, "destinacao", result.insertId, "criada", null, { ...valores, recebimentoId: input.recebimentoId }));
    return { id: result.insertId };
  });
}

export async function cancelarDestinacaoDec(input: { id: number; recebimentoId: number }, operador: Operador) {
  const db = await getDb(); if (!db) throw indisponivel();
  return db.transaction(async tx => {
    await tx.select().from(decRecebimentos).where(eq(decRecebimentos.id, input.recebimentoId)).for("update");
    const [anterior] = await tx.select().from(decDestinacoes).where(eq(decDestinacoes.id, input.id)).for("update");
    if (!anterior || anterior.recebimentoId !== input.recebimentoId || anterior.quantidade === 0) throw inexistente("Destinação");
    await tx.update(decDestinacoes).set({ quantidade: 0 }).where(eq(decDestinacoes.id, input.id));
    await tx.insert(decAuditoria).values(auditor(operador, "destinacao", input.id, "cancelada", anterior, { quantidade: 0, recebimentoId: input.recebimentoId }));
    return { id: input.id };
  });
}

export async function listarClientesDec(pesquisa: string) {
  const db = await getDb(); if (!db) throw indisponivel();
  const encontrados = await db.select({ id: clientes.id, cnpj: clientes.cnpj, razaoSocial: clientes.razaoSocial, ativo: clientes.ativo }).from(clientes).orderBy(asc(clientes.razaoSocial));
  const q = pesquisa.trim().toLocaleLowerCase("pt-BR");
  return encontrados.filter(c => c.razaoSocial.toLocaleLowerCase("pt-BR").includes(q) || c.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, "")) && !!q.replace(/\D/g, "")).slice(0, 60);
}

export async function listarRecebimentosDec(input: { inicio: string; fim: string; categoriaId?: number; operadorId?: number; clienteId?: number }) {
  const db = await getDb(); if (!db) throw indisponivel();
  const condicoes = [filtroPeriodoRecebimentosDec(input.inicio, input.fim)];
  if (input.categoriaId) condicoes.push(eq(decRecebimentos.categoriaId, input.categoriaId));
  if (input.operadorId) condicoes.push(eq(decRecebimentos.operadorId, input.operadorId));
  const recebimentos = await db.select({ lote: decRecebimentos, categoria: decCategorias.nome })
    .from(decRecebimentos).innerJoin(decCategorias, eq(decCategorias.id, decRecebimentos.categoriaId))
    .where(and(...condicoes)).orderBy(asc(decRecebimentos.dataRecebimento), asc(decRecebimentos.id));
  if (!recebimentos.length) return [];
  const destinos = await db.select().from(decDestinacoes).where(inArray(decDestinacoes.recebimentoId, recebimentos.map(l => l.lote.id)));
  return recebimentos.map(({ lote, categoria }) => {
    const alocacoes = destinos.filter(d => d.quantidade > 0 && d.recebimentoId === lote.id && (!input.clienteId || d.clienteId === input.clienteId));
    const { redirecionadas, varias, internas, semAcao, inativos } = somarDestinacoesDec(alocacoes);
    return { ...lote, categoria, quantidade: input.clienteId ? redirecionadas + semAcao + inativos : lote.quantidade,
      destinacoes: alocacoes, redirecionadas, varias, internas, semAcao, inativos,
      pendentes: input.clienteId ? 0 : lote.quantidade - redirecionadas - internas - semAcao - inativos };
  }).filter(l => !input.clienteId || l.destinacoes.length > 0);
}

export async function listarAuditoriaDec(recebimentoId: number) {
  const db = await getDb(); if (!db) throw indisponivel();
  const destinos = await db.select({ id: decDestinacoes.id }).from(decDestinacoes).where(eq(decDestinacoes.recebimentoId, recebimentoId));
  const ids = destinos.map(d => d.id);
  return db.select().from(decAuditoria).where(or(
    and(eq(decAuditoria.entidade, "recebimento"), eq(decAuditoria.entidadeId, recebimentoId)),
    ids.length ? and(eq(decAuditoria.entidade, "destinacao"), inArray(decAuditoria.entidadeId, ids)) : undefined,
  )).orderBy(asc(decAuditoria.createdAt), asc(decAuditoria.id));
}
