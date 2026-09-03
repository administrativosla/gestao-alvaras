import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  addCertidaoVersao: vi.fn(),
  createCertidaoConsulta: vi.fn(),
  getCertidaoConsultaById: vi.fn(),
  getClienteById: vi.fn(),
  listCertidaoConsultas: vi.fn(),
  listCertidaoVersoes: vi.fn(),
  updateCertidaoConsulta: vi.fn(),
  storagePut: vi.fn(),
}));

vi.mock("./db", () => ({
  addCertidaoVersao: mocks.addCertidaoVersao,
  createCertidaoConsulta: mocks.createCertidaoConsulta,
  getCertidaoConsultaById: mocks.getCertidaoConsultaById,
  getClienteById: mocks.getClienteById,
  listCertidaoConsultas: mocks.listCertidaoConsultas,
  listCertidaoVersoes: mocks.listCertidaoVersoes,
  updateCertidaoConsulta: mocks.updateCertidaoConsulta,
}));

vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

import { certidoesRouter } from "./routers/certidoes";

function criarContexto(autenticado = true): TrpcContext {
  return {
    user: autenticado ? ({
      id: 7,
      openId: "operador-teste",
      name: "Operador Responsável",
      email: "operador@example.com",
      loginMethod: "manus",
      role: "master",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>) : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("router de certidões", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCertidaoConsultas.mockResolvedValue([]);
    mocks.listCertidaoVersoes.mockResolvedValue([]);
  });

  it("grava o usuário autenticado como operador ao iniciar a consulta", async () => {
    mocks.getClienteById.mockResolvedValue({
      id: 42,
      ativo: true,
      cnpj: "11.222.333/0001-81",
      razaoSocial: "Empresa Autorizada",
    });
    mocks.createCertidaoConsulta.mockResolvedValue(101);

    const caller = certidoesRouter.createCaller(criarContexto());
    const resposta = await caller.iniciar({ clienteId: 42, origem: "consulta_anterior" });

    expect(resposta.id).toBe(101);
    expect(mocks.createCertidaoConsulta).toHaveBeenCalledWith(expect.objectContaining({
      clienteId: 42,
      operadorId: 7,
      operadorNome: "Operador Responsável",
      origem: "consulta_anterior",
    }));
  });

  it("finaliza uma versão textual e impede sobrescrever uma consulta concluída", async () => {
    mocks.getCertidaoConsultaById.mockResolvedValueOnce({ id: 101, clienteId: 42, status: "iniciada" });
    mocks.addCertidaoVersao.mockResolvedValue({ id: 1, versao: 1 });

    const caller = certidoesRouter.createCaller(criarContexto());
    await caller.registrarResultado({ id: 101, resultado: "negativa", mensagemCapturada: "Certidão localizada." });

    expect(mocks.updateCertidaoConsulta).toHaveBeenCalledWith(101, expect.objectContaining({
      status: "concluida",
      resultado: "negativa",
      finalizadoPorId: 7,
      finalizadoPorNome: "Operador Responsável",
    }));
    expect(mocks.addCertidaoVersao).toHaveBeenCalledWith(expect.objectContaining({
      consultaId: 101,
      tipo: "texto",
      textoCapturado: "Certidão localizada.",
    }));

    mocks.getCertidaoConsultaById.mockResolvedValueOnce({ id: 101, clienteId: 42, status: "concluida" });
    await expect(caller.registrarResultado({ id: 101, resultado: "erro" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("valida o PDF, envia bytes ao S3 e persiste apenas metadados", async () => {
    mocks.getCertidaoConsultaById.mockResolvedValue({ id: 101, clienteId: 42, status: "iniciada" });
    mocks.storagePut.mockResolvedValue({ key: "certidoes/42/101/cnd_abcd.pdf", url: "/manus-storage/certidoes/42/101/cnd_abcd.pdf" });
    mocks.addCertidaoVersao.mockResolvedValue({ id: 9, versao: 1 });
    const pdf = Buffer.from("%PDF-1.7\nconteudo autorizado").toString("base64");

    const caller = certidoesRouter.createCaller(criarContexto());
    const resposta = await caller.anexarVersao({
      consultaId: 101,
      fileBase64: pdf,
      fileName: "CND Federal.pdf",
      mimeType: "application/pdf",
      validadeAte: "2027-03-03",
    });

    expect(resposta).toMatchObject({ id: 9, versao: 1, fileName: "CND-Federal.pdf" });
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringContaining("certidoes/42/101/"), expect.any(Buffer), "application/pdf");
    expect(mocks.addCertidaoVersao).toHaveBeenCalledWith(expect.objectContaining({
      consultaId: 101,
      clienteId: 42,
      fileKey: "certidoes/42/101/cnd_abcd.pdf",
      fileSize: expect.any(Number),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      capturadoPorId: 7,
    }));
    expect(mocks.addCertidaoVersao.mock.calls[0][0]).not.toHaveProperty("fileBase64");
  });

  it("rejeita conteúdo incompatível antes de acessar o armazenamento", async () => {
    mocks.getCertidaoConsultaById.mockResolvedValue({ id: 101, clienteId: 42, status: "iniciada" });
    const caller = certidoesRouter.createCaller(criarContexto());

    await expect(caller.anexarVersao({
      consultaId: 101,
      fileBase64: Buffer.from("arquivo falso").toString("base64"),
      fileName: "falso.pdf",
      mimeType: "application/pdf",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("nega acesso ao histórico quando não há usuário autenticado", async () => {
    const caller = certidoesRouter.createCaller(criarContexto(false));
    await expect(caller.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
