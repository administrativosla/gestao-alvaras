import { describe, expect, it } from "vitest";
import { parseDate, formatDateBR, formatDateISO } from "./utils/parseDate";

describe("parseDate — formatos brasileiros", () => {
  // Todos os testes esperam 31 de dezembro de 2025

  it("DD/MM/YYYY", () => {
    const d = parseDate("31/12/2025");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2025);
    expect(d!.getUTCMonth()).toBe(11); // 0-indexed
    expect(d!.getUTCDate()).toBe(31);
  });

  it("DD/MM/YY (ano 2 dígitos)", () => {
    const d = parseDate("31/12/25");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2025);
  });

  it("DD-MM-YYYY", () => {
    const d = parseDate("31-12-2025");
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(31);
    expect(d!.getUTCMonth()).toBe(11);
  });

  it("DD-MM-YY", () => {
    const d = parseDate("31-12-25");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2025);
  });

  it("DD.MM.YYYY", () => {
    const d = parseDate("31.12.2025");
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(31);
  });

  it("DD.MM.YY", () => {
    const d = parseDate("31.12.25");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2025);
  });

  it("YYYY-MM-DD (ISO 8601)", () => {
    const d = parseDate("2025-12-31");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2025);
    expect(d!.getUTCDate()).toBe(31);
  });

  it("YYYY/MM/DD", () => {
    const d = parseDate("2025/12/31");
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(31);
  });

  it("YYYY.MM.DD", () => {
    const d = parseDate("2025.12.31");
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(31);
  });

  it("DD MM YYYY (espaço como separador)", () => {
    const d = parseDate("31 12 2025");
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(31);
  });

  it("D/M/YYYY (sem zero à esquerda)", () => {
    const d = parseDate("1/1/2025");
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(1);
    expect(d!.getUTCMonth()).toBe(0);
  });

  it("YYYYMMDD (compacto 8 dígitos)", () => {
    const d = parseDate("20251231");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2025);
    expect(d!.getUTCDate()).toBe(31);
  });

  it("DDMMYYYY (compacto 8 dígitos)", () => {
    const d = parseDate("31122025");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2025);
    expect(d!.getUTCDate()).toBe(31);
  });

  it("Número serial do Excel", () => {
    // 45657 = 31/12/2024 no Excel
    const d = parseDate(45657);
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2024);
  });

  it("Com sufixo de hora (DD/MM/YYYY HH:MM:SS)", () => {
    const d = parseDate("31/12/2025 00:00:00");
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(31);
  });

  it("Date object passado diretamente", () => {
    const input = new Date(Date.UTC(2025, 11, 31));
    const d = parseDate(input);
    expect(d).toBe(input);
  });

  it("null retorna null", () => {
    expect(parseDate(null)).toBeNull();
  });

  it("string vazia retorna null", () => {
    expect(parseDate("")).toBeNull();
  });

  it("string inválida retorna null", () => {
    expect(parseDate("nao-e-uma-data")).toBeNull();
  });
});

describe("formatDateBR", () => {
  it("formata corretamente para DD/MM/YYYY", () => {
    const d = new Date(Date.UTC(2025, 11, 31));
    expect(formatDateBR(d)).toBe("31/12/2025");
  });

  it("retorna string vazia para null", () => {
    expect(formatDateBR(null)).toBe("");
  });
});

describe("formatDateISO", () => {
  it("formata corretamente para YYYY-MM-DD", () => {
    const d = new Date(Date.UTC(2025, 11, 31));
    expect(formatDateISO(d)).toBe("2025-12-31");
  });

  it("retorna null para null", () => {
    expect(formatDateISO(null)).toBeNull();
  });
});
