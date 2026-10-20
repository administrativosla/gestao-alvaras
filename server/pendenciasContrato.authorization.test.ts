import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getDb: getDbMock };
});

import { appRouter } from "./routers";

function createOperatorContext(): TrpcContext {
  return {
    user: {
      id: 997,
      openId: "operator-pendencias-test",
      email: "operator.pendencias@example.com",
      name: "Operador de teste",
      loginMethod: "manus",
      role: "operator",
      userStatus: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("relatório periódico de pendências", () => {
  beforeEach(() => getDbMock.mockReset());

  it("bloqueia a exportação antes de consultar dados quando o perfil não possui permissão", async () => {
    const limit = vi.fn().mockResolvedValue([{ permitido: false }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    getDbMock.mockResolvedValue({ select });

    const caller = appRouter.createCaller(createOperatorContext());
    await expect(caller.pendenciasContrato.relatorio({ inicio: "2026-10-01", fim: "2026-10-20" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Você não tem permissão para executar esta ação.",
    });
  });
});
