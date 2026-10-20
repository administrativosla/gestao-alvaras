import { describe, expect, it } from "vitest";
import { identificarAreaPortal, obterAreasAlternativas, PORTAL_AREAS, ROTA_HISTORICO_DEC, ROTA_PENDENCIAS_CONTRATO, ROTA_RELATORIO_DEC, ROTAS_CADASTRO_EMPRESARIAL } from "../shared/portal";

describe("navegação do Portal Controller", () => {
  it("mantém rotas iniciais distintas para as três ferramentas", () => {
    expect(PORTAL_AREAS.alvaras.rota).toBe("/gestor-alvaras");
    expect(PORTAL_AREAS.dec.rota).toBe("/dec");
    expect(PORTAL_AREAS.pendencias.rota).toBe("/pendencias-contrato");
    expect(Object.keys(PORTAL_AREAS)).toEqual(["alvaras", "dec", "pendencias"]);
  });
  it("identifica o hub e as áreas internas pela URL", () => {
    expect(identificarAreaPortal("/")).toBe("hub");
    expect(identificarAreaPortal("/dec")).toBe("dec");
    expect(identificarAreaPortal("/dec/categorias")).toBe("dec");
    expect(ROTA_HISTORICO_DEC).toBe("/dec/historico");
    expect(identificarAreaPortal(ROTA_HISTORICO_DEC)).toBe("dec");
    expect(ROTA_RELATORIO_DEC).toBe("/dec/relatorio");
    expect(identificarAreaPortal(ROTA_RELATORIO_DEC)).toBe("dec");
    expect(ROTA_PENDENCIAS_CONTRATO).toBe("/pendencias-contrato");
    expect(identificarAreaPortal(`${ROTA_PENDENCIAS_CONTRATO}/lista`)).toBe("pendencias");
    expect(identificarAreaPortal("/clientes")).toBe("alvaras");
  });
  it("oferece as demais áreas como alternativas", () => {
    expect(obterAreasAlternativas("alvaras")).toEqual([
      { nome: "Quantificador de Mensagens DEC", rota: "/dec" },
      { nome: "Gestor de Pendências", rota: "/pendencias-contrato" },
    ]);
    expect(obterAreasAlternativas("pendencias")).toHaveLength(2);
  });
  it("expõe a mesma tabela de clientes nas três ferramentas", () => {
    expect(ROTAS_CADASTRO_EMPRESARIAL.alvaras).toBe("/clientes");
    expect(ROTAS_CADASTRO_EMPRESARIAL.dec).toBe("/dec/clientes");
    expect(ROTAS_CADASTRO_EMPRESARIAL.pendencias).toBe("/pendencias-contrato/clientes");
  });
});
