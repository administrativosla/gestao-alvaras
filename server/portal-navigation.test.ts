import { describe, expect, it } from "vitest";
import { identificarAreaPortal, obterAreaAlternativa, PORTAL_AREAS, ROTA_HISTORICO_DEC, ROTA_RELATORIO_DEC, ROTAS_CADASTRO_EMPRESARIAL } from "../shared/portal";

describe("navegação do Portal Controller", () => {
  it("mantém rotas iniciais distintas para as duas ferramentas", () => {
    expect(PORTAL_AREAS.alvaras.rota).toBe("/gestor-alvaras");
    expect(PORTAL_AREAS.dec.rota).toBe("/dec");
    expect(Object.keys(PORTAL_AREAS)).toEqual(["alvaras", "dec"]);
  });
  it("identifica o hub e as áreas internas pela URL", () => {
    expect(identificarAreaPortal("/")).toBe("hub");
    expect(identificarAreaPortal("/dec")).toBe("dec");
    expect(identificarAreaPortal("/dec/categorias")).toBe("dec");
    expect(ROTA_HISTORICO_DEC).toBe("/dec/historico");
    expect(identificarAreaPortal(ROTA_HISTORICO_DEC)).toBe("dec");
    expect(ROTA_RELATORIO_DEC).toBe("/dec/relatorio");
    expect(identificarAreaPortal(ROTA_RELATORIO_DEC)).toBe("dec");
    expect(identificarAreaPortal("/clientes")).toBe("alvaras");
  });
  it("alterna diretamente entre Alvarás e DEC", () => {
    expect(obterAreaAlternativa("alvaras")).toEqual({ nome: "Quantificador de Mensagens DEC", rota: "/dec" });
    expect(obterAreaAlternativa("dec")).toEqual({ nome: "Gestor de Alvarás", rota: "/gestor-alvaras" });
  });
  it("expõe a mesma tabela de clientes nas duas ferramentas", () => {
    expect(ROTAS_CADASTRO_EMPRESARIAL.alvaras).toBe("/clientes");
    expect(ROTAS_CADASTRO_EMPRESARIAL.dec).toBe("/dec/clientes");
  });
});
