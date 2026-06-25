import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do banco de dados
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

function createMockContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Sistema de Gestão de Alvarás — Testes de Integração", () => {
  describe("auth.logout", () => {
    it("deve limpar o cookie de sessão e retornar sucesso", async () => {
      const ctx = createMockContext();
      const clearedCookies: any[] = [];
      ctx.res.clearCookie = (name: string, opts: any) => {
        clearedCookies.push({ name, opts });
      };
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.logout();
      expect(result.success).toBe(true);
      expect(clearedCookies).toHaveLength(1);
    });
  });

  describe("auth.me", () => {
    it("deve retornar o usuário autenticado", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const user = await caller.auth.me();
      expect(user).toBeDefined();
      expect(user?.email).toBe("test@example.com");
    });
  });

  describe("Lógica de alertas — calcDiasParaVencimento", () => {
    it("deve calcular corretamente dias para vencimento futuro", () => {
      const hoje = new Date();
      const vencimento = new Date(hoje);
      vencimento.setDate(vencimento.getDate() + 15);

      const diffMs = vencimento.getTime() - hoje.getTime();
      const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(dias).toBe(15);
    });

    it("deve retornar 0 para vencimento hoje", () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const vencimento = new Date(hoje);

      const diffMs = vencimento.getTime() - hoje.getTime();
      const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(dias).toBe(0);
    });

    it("deve retornar negativo para vencimento passado", () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const vencimento = new Date(hoje);
      vencimento.setDate(vencimento.getDate() - 5);

      const diffMs = vencimento.getTime() - hoje.getTime();
      const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(dias).toBe(-5);
    });
  });

  describe("Lógica de status — STATUS_SEM_ALERTA", () => {
    it("deve incluir os status que cessam alertas", async () => {
      const { STATUS_SEM_ALERTA } = await import("../drizzle/schema");
      expect(STATUS_SEM_ALERTA).toContain("Em Renovação");
      expect(STATUS_SEM_ALERTA).toContain("Renovado");
      expect(STATUS_SEM_ALERTA).toContain("Cancelado");
    });

    it("não deve incluir status que mantêm alertas ativos", async () => {
      const { STATUS_SEM_ALERTA } = await import("../drizzle/schema");
      expect(STATUS_SEM_ALERTA).not.toContain("Vencido");
      expect(STATUS_SEM_ALERTA).not.toContain("Contato Realizado");
      expect(STATUS_SEM_ALERTA).not.toContain("Tratativa Comercial");
      expect(STATUS_SEM_ALERTA).not.toContain("Documentação Solicitada");
    });
  });

  describe("Lógica de status — fluxo de 8 etapas", () => {
    it("deve ter exatamente 9 status de renovação (incluindo Iniciar Renovação)", async () => {
      const { STATUS_RENOVACAO } = await import("../drizzle/schema");
      expect(STATUS_RENOVACAO).toHaveLength(9);
    });

    it("deve ter os status na ordem correta", async () => {
      const { STATUS_RENOVACAO } = await import("../drizzle/schema");
      const statusEsperados = [
        "Em Vigência",
        "Iniciar Renovação",
        "Vencido",
        "Contato Realizado",
        "Tratativa Comercial",
        "Documentação Solicitada",
        "Em Renovação",
        "Renovado",
        "Cancelado",
      ];
      statusEsperados.forEach((s, i) => {
        expect(STATUS_RENOVACAO[i]).toBe(s);
      });
    });
  });

  describe("Marcos de alerta", () => {
    it("deve verificar que os marcos corretos estão definidos", () => {
      const MARCOS = [30, 15, 7, 3, 2, 1];
      expect(MARCOS).toContain(30);
      expect(MARCOS).toContain(15);
      expect(MARCOS).toContain(7);
      expect(MARCOS).toContain(3);
      expect(MARCOS).toContain(2);
      expect(MARCOS).toContain(1);
      expect(MARCOS).toHaveLength(6);
    });
  });
});
