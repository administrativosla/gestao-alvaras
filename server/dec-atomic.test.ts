import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientes, decAuditoria, decCategorias, decDestinacoes, decRecebimentos } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
import { criarRecebimentoDec } from "./dec-db";

function bancoSimulado({ falharNaDestinacao = false } = {}) {
  const gravados: Array<{ tabela: unknown; valores: Record<string, unknown> }> = [];
  const db = {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const pendentes: typeof gravados = [];
      const tx = {
        select: () => ({ from: (tabela: unknown) => ({ where: () => ({
          limit: async () => tabela === decCategorias ? [{ id: 2, ativa: true }] : tabela === clientes ? [{ id: 34, ativo: true, razaoSocial: "Cliente ativo" }] : [],
        }) }) }),
        insert: (tabela: unknown) => ({ values: async (valores: Record<string, unknown>) => {
          if (falharNaDestinacao && tabela === decDestinacoes) throw Error("Falha ao gravar destino");
          pendentes.push({ tabela, valores });
          return [{ insertId: tabela === decRecebimentos ? 50 : tabela === decDestinacoes ? 70 : 100 }];
        } }),
      };
      const resultado = await callback(tx);
      gravados.push(...pendentes);
      return resultado;
    },
  };
  mocks.getDb.mockResolvedValue(db);
  return gravados;
}

const operador = { id: 5, nome: "Operador DEC" };
const base = { categoriaId: 2, dia: "2026-10-05", quantidade: 5 };

describe("lançamento DEC com classificação no mesmo envio", () => {
  beforeEach(() => vi.clearAllMocks());
  it("grava lote e múltiplas destinações na mesma transação, preservando pendência", async () => {
    const gravados = bancoSimulado();
    const resultado = await criarRecebimentoDec({ ...base, destinacoes: [
      { tipo: "redirecionada_ativo", quantidade: 2, clienteId: 34 },
      { tipo: "encaminhada_time_interno", quantidade: 1, observacao: "Equipe fiscal" },
      { tipo: "redirecionada_varias", quantidade: 1, observacao: "DEC Anatel a todas as empresas" },
    ] }, operador);
    expect(resultado).toEqual({ id: 50 });
    expect(gravados.filter(item => item.tabela === decRecebimentos)).toHaveLength(1);
    expect(gravados.filter(item => item.tabela === decDestinacoes).map(item => item.valores)).toMatchObject([
      { recebimentoId: 50, tipo: "redirecionada_ativo", quantidade: 2, clienteId: 34, clienteNome: "Cliente ativo", operadorId: 5 },
      { recebimentoId: 50, tipo: "encaminhada_time_interno", quantidade: 1, clienteId: null, operadorId: 5 },
      { recebimentoId: 50, tipo: "redirecionada_varias", quantidade: 1, clienteId: null, clienteNome: null, operadorId: 5 },
    ]);
    expect(gravados.filter(item => item.tabela === decAuditoria)).toHaveLength(4);
  });
  it("mantém lançamento sem destinação para classificação posterior", async () => {
    const gravados = bancoSimulado();
    await criarRecebimentoDec(base, operador);
    expect(gravados.filter(item => item.tabela === decRecebimentos)).toHaveLength(1);
    expect(gravados.filter(item => item.tabela === decDestinacoes)).toHaveLength(0);
  });
  it("rejeita soma acima do recebido ou cliente inválido sem salvar nada", async () => {
    const gravados = bancoSimulado();
    await expect(criarRecebimentoDec({ ...base, destinacoes: [{ tipo: "arquivada_sem_acao", quantidade: 6 }] }, operador)).rejects.toThrow(/Restam 5/);
    await expect(criarRecebimentoDec({ ...base, destinacoes: [{ tipo: "redirecionada_ativo", quantidade: 1 }] }, operador)).rejects.toThrow(/cliente ativo/);
    await expect(criarRecebimentoDec({ ...base, destinacoes: [{ tipo: "redirecionada_varias", quantidade: 1, clienteId: 34 }] }, operador)).rejects.toThrow(/não pode ser vinculado/);
    expect(gravados).toHaveLength(0);
  });
  it("reverte o lote se a gravação de um destino falhar", async () => {
    const gravados = bancoSimulado({ falharNaDestinacao: true });
    await expect(criarRecebimentoDec({ ...base, destinacoes: [{ tipo: "arquivada_sem_acao", quantidade: 1 }] }, operador)).rejects.toThrow(/Falha ao gravar destino/);
    expect(gravados).toHaveLength(0);
  });
});
