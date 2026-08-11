import { expect, describe, it, vi, beforeEach } from "vitest";
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
      id: 999,
      openId: "operator-test",
      email: "operator@example.com",
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

describe("requirePermissao", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("bloqueia a revalidação de RFB antes de executar o handler quando o perfil não possui a ação", async () => {
    const limit = vi.fn().mockResolvedValue([{ permitido: false }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    getDbMock.mockResolvedValue({ select });

    const caller = appRouter.createCaller(createOperatorContext());

    await expect(caller.alvaras.revalidar({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Você não tem permissão para executar esta ação.",
    });
  });
});
