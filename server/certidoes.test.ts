import { describe, expect, it } from "vitest";
import {
  detectarTipoArquivoCertidao,
  nomeArquivoSeguro,
  statusFinalDoResultado,
} from "../shared/certidoes";

describe("regras de arquivos e resultados de certidões", () => {
  it("aceita PDF pela assinatura real, não apenas pelo nome", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(detectarTipoArquivoCertidao(pdf, "application/pdf")).toBe("pdf");
    expect(detectarTipoArquivoCertidao(pdf, "image/png")).toBeNull();
  });

  it("aceita imagens permitidas e rejeita conteúdo incompatível", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const texto = new TextEncoder().encode("não é uma imagem");
    expect(detectarTipoArquivoCertidao(png, "image/png")).toBe("imagem");
    expect(detectarTipoArquivoCertidao(texto, "image/png")).toBeNull();
  });

  it("normaliza nomes de arquivo e limita caracteres perigosos", () => {
    expect(nomeArquivoSeguro("CND Federal 2026/2027.pdf")).toBe("CND-Federal-2026-2027.pdf");
    expect(nomeArquivoSeguro("../../arquivo.pdf")).toBe("arquivo.pdf");
  });

  it("define o status final a partir do resultado", () => {
    expect(statusFinalDoResultado("negativa")).toBe("concluida");
    expect(statusFinalDoResultado("indisponivel")).toBe("indisponivel");
    expect(statusFinalDoResultado("erro")).toBe("erro");
  });
});
