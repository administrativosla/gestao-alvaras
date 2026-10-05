import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { validarSaldoDec, validarStatusClienteDec } from "./dec-db";

const mocks = vi.hoisted(() => ({
  listarCategoriasDec: vi.fn(), salvarCategoriaDec: vi.fn(), listarClientesDec: vi.fn(),
  listarRecebimentosDec: vi.fn(), criarRecebimentoDec: vi.fn(), corrigirRecebimentoDec: vi.fn(),
  salvarDestinacaoDec: vi.fn(), cancelarDestinacaoDec: vi.fn(), listarAuditoriaDec: vi.fn(),
}));
vi.mock("./dec-db", async importOriginal => ({ ...await importOriginal<typeof import("./dec-db")>(), ...mocks }));
import { decRouter } from "./routers/dec";

function contexto(role: "master" | "operator" = "master", logado = true): TrpcContext {
  return { user: logado ? ({ id: 5, openId: "teste-dec", name: "Operadora DEC", role, userStatus: "active", email: null,
    loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }) : null,
    req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("Quantificador DEC", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.listarCategoriasDec.mockResolvedValue([]); mocks.listarRecebimentosDec.mockResolvedValue([]); });
  it("só permite acesso ao operador autenticado", async () => {
    await expect(decRouter.createCaller(contexto("operator", false)).categorias()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("reserva manutenção de categorias ao gestor, liberando lançamento para o operador", async () => {
    const caller = decRouter.createCaller(contexto("operator"));
    await expect(caller.salvarCategoria({ nome: "Intimações" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    mocks.criarRecebimentoDec.mockResolvedValue({ id: 12 });
    await caller.criarRecebimento({ categoriaId: 4, dia: "2026-10-05", quantidade: 10 });
    expect(mocks.criarRecebimentoDec).toHaveBeenCalledWith(expect.objectContaining({ quantidade: 10 }), { id: 5, nome: "Operadora DEC" });
  });
  it("registra o responsável por cancelamentos em vez de apagar o histórico", async () => {
    const caller = decRouter.createCaller(contexto("operator"));
    mocks.cancelarDestinacaoDec.mockResolvedValue({ id: 8 });
    await caller.cancelarDestinacao({ id: 8, recebimentoId: 12 });
    expect(mocks.cancelarDestinacaoDec).toHaveBeenCalledWith({ id: 8, recebimentoId: 12 }, { id: 5, nome: "Operadora DEC" });
  });
  it("permite classificar mensagens como enviadas a ativo ou arquivadas pelo operador", async () => {
    const caller = decRouter.createCaller(contexto("operator"));
    mocks.salvarDestinacaoDec.mockResolvedValue({ id: 9 });
    await caller.salvarDestinacao({ recebimentoId: 12, tipo: "redirecionada_ativo", quantidade: 1, clienteId: 34 });
    await caller.salvarDestinacao({ recebimentoId: 12, tipo: "arquivada_sem_acao", quantidade: 2 });
    expect(mocks.salvarDestinacaoDec).toHaveBeenNthCalledWith(1, expect.objectContaining({ tipo: "redirecionada_ativo", clienteId: 34 }), { id: 5, nome: "Operadora DEC" });
    expect(mocks.salvarDestinacaoDec).toHaveBeenNthCalledWith(2, expect.objectContaining({ tipo: "arquivada_sem_acao", quantidade: 2 }), { id: 5, nome: "Operadora DEC" });
  });
  it("impede contagens negativas, fracionárias e datas inexistentes", async () => {
    const caller = decRouter.createCaller(contexto());
    await expect(caller.criarRecebimento({ categoriaId: 1, dia: "2026-02-30", quantidade: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.criarRecebimento({ categoriaId: 1, dia: "2026-10-05", quantidade: -2 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.salvarDestinacao({ recebimentoId: 1, tipo: "arquivada_sem_acao", quantidade: 1.5 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("impede somar destinações acima do recebido, permitindo corrigir valor substituído", () => {
    expect(() => validarSaldoDec(20, 8, 12)).not.toThrow();
    expect(() => validarSaldoDec(20, 8, 13)).toThrow(/Restam 12/);
    expect(() => validarSaldoDec(20, 15, 5)).not.toThrow();
  });
  it("distingue cliente ativo de cliente inativo pelo estado da base compartilhada", () => {
    expect(() => validarStatusClienteDec("redirecionada_ativo", { ativo: true })).not.toThrow();
    expect(() => validarStatusClienteDec("redirecionada_ativo", { ativo: false })).toThrow(/ativo/);
    expect(() => validarStatusClienteDec("arquivada_inativo", { ativo: true })).toThrow(/inativo/);
    expect(() => validarStatusClienteDec("arquivada_inativo", { ativo: false })).not.toThrow();
    expect(() => validarStatusClienteDec("arquivada_inativo", null)).not.toThrow();
  });
});
