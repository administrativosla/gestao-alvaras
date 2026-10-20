import { describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getDb: getDbMock };
});

import { processarContatoSemRetornoAutomatico } from "./routers/pendenciasContrato";

describe("processarContatoSemRetornoAutomatico", () => {
  it("move apenas contatos vencidos para sem retorno e registra evento automático", async () => {
    const whereSelect = vi.fn().mockResolvedValue([{ id: 12, clienteId: 41, status: "cliente_contatado" }]);
    const from = vi.fn().mockReturnValue({ where: whereSelect });
    const select = vi.fn().mockReturnValue({ from });
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });
    getDbMock.mockResolvedValue({ select, update, insert });

    const resultado = await processarContatoSemRetornoAutomatico();

    expect(resultado).toEqual({ processadas: 1, ids: [12] });
    expect(updateSet).toHaveBeenCalledWith({ status: "contato_sem_retorno", retornoAte: null });
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      pendenciaId: 12,
      clienteId: 41,
      statusAnterior: "cliente_contatado",
      statusNovo: "contato_sem_retorno",
      tipoEvento: "automatico",
    }));
  });
});
