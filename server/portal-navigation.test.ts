import { describe, expect, it } from "vitest";
import { identificarAreaPortal, obterAreaAlternativa, PORTAL_AREAS } from "../shared/portal";

describe("navegação do Portal Controller", () => {
  it("mantém rotas iniciais distintas para os dois gestores", () => {
    expect(PORTAL_AREAS.alvaras.rota).toBe("/gestor-alvaras");
    expect(PORTAL_AREAS.certidoes.rota).toBe("/certidoes");
    expect(PORTAL_AREAS.alvaras.rota).not.toBe(PORTAL_AREAS.certidoes.rota);
  });

  it("identifica o hub e as áreas internas pela URL", () => {
    expect(identificarAreaPortal("/")).toBe("hub");
    expect(identificarAreaPortal("/certidoes")).toBe("certidoes");
    expect(identificarAreaPortal("/certidoes/consultas")).toBe("certidoes");
    expect(identificarAreaPortal("/clientes")).toBe("alvaras");
  });

  it("alterna diretamente entre os dois gestores", () => {
    expect(obterAreaAlternativa("alvaras")).toEqual({ nome: "Gestor de Certidões", rota: "/certidoes" });
    expect(obterAreaAlternativa("certidoes")).toEqual({ nome: "Gestor de Alvarás", rota: "/gestor-alvaras" });
  });
});
