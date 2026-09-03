import { describe, expect, it } from "vitest";
import {
  avaliarCompletudeCadastro,
  CAMPOS_CADASTRO,
  correspondeAosFiltrosCompletude,
} from "../shared/completudeCadastro";

const cadastroCompleto = Object.fromEntries(CAMPOS_CADASTRO.map(({ campo }) => [campo, "preenchido"]));

describe("completude do cadastro empresarial", () => {
  it("classifica um cadastro integral como completo", () => {
    const resultado = avaliarCompletudeCadastro(cadastroCompleto);
    expect(resultado.percentual).toBe(100);
    expect(resultado.status).toBe("Completo");
    expect(resultado.pendencias).toHaveLength(0);
  });

  it("lista inscrições fiscais ausentes como pendências automatizáveis", () => {
    const resultado = avaliarCompletudeCadastro({
      ...cadastroCompleto,
      inscricaoEstadual: "",
      inscricaoMunicipal: null,
    });

    expect(resultado.pendencias.map((item) => item.campo)).toEqual([
      "inscricaoEstadual",
      "inscricaoMunicipal",
    ]);
    expect(resultado.pendencias.every((item) => item.automatizavel)).toBe(true);
  });

  it("classifica cadastros muito incompletos como críticos", () => {
    const resultado = avaliarCompletudeCadastro({ cnpj: "11.222.333/0001-81", razaoSocial: "Empresa" });
    expect(resultado.status).toBe("Crítico");
    expect(resultado.percentual).toBeLessThan(55);
  });

  it("filtra pelo nível de completude", () => {
    const completo = avaliarCompletudeCadastro(cadastroCompleto);
    const critico = avaliarCompletudeCadastro({ cnpj: "11.222.333/0001-81" });

    expect(correspondeAosFiltrosCompletude(completo, { status: "Completo" })).toBe(true);
    expect(correspondeAosFiltrosCompletude(critico, { status: "Completo" })).toBe(false);
  });

  it("filtra pela pendência selecionada e combina os dois critérios", () => {
    const semInscricoes = avaliarCompletudeCadastro({
      ...cadastroCompleto,
      inscricaoEstadual: null,
      inscricaoMunicipal: "",
    });

    expect(correspondeAosFiltrosCompletude(semInscricoes, { pendencia: "inscricaoEstadual" })).toBe(true);
    expect(correspondeAosFiltrosCompletude(semInscricoes, { pendencia: "email" })).toBe(false);
    expect(correspondeAosFiltrosCompletude(semInscricoes, {
      status: "Em complementação",
      pendencia: "inscricaoMunicipal",
    })).toBe(true);
  });
});
