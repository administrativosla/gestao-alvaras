import { describe, expect, it } from "vitest";
import { cnpjValido, formatarCnpj, obterDigitosCnpj } from "../shared/cnpj";
import { clienteSchema } from "./routers/clientes";

describe("utilitários de CNPJ", () => {
  it("formata progressivamente e limita a entrada a 14 dígitos", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCnpj("11222333000181999")).toBe("11.222.333/0001-81");
    expect(obterDigitosCnpj("11.222.333/0001-81")).toBe("11222333000181");
  });

  it("valida os dígitos verificadores e rejeita sequências repetidas", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("00.000.000/0000-00")).toBe(false);
  });

  it("normaliza o CNPJ no contrato de criação e preserva IE e IM", () => {
    const resultado = clienteSchema.parse({
      cnpj: "11222333000181",
      razaoSocial: "Empresa de Teste",
      inscricaoEstadual: "110.042.490.114",
      inscricaoMunicipal: "12345678",
    });

    expect(resultado.cnpj).toBe("11.222.333/0001-81");
    expect(resultado.inscricaoEstadual).toBe("110.042.490.114");
    expect(resultado.inscricaoMunicipal).toBe("12345678");
  });

  it("bloqueia cadastro com CNPJ inválido", () => {
    const resultado = clienteSchema.safeParse({
      cnpj: "12.345.678/0001-90",
      razaoSocial: "Empresa Inválida",
    });

    expect(resultado.success).toBe(false);
  });
});
