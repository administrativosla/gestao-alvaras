export const RECEITA_CERTIDOES_URL = "https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj";

export const RESULTADOS_CERTIDAO = [
  "nao_classificado",
  "negativa",
  "positiva",
  "positiva_efeito_negativa",
  "sem_certidao_valida",
  "indisponivel",
  "erro",
] as const;

export type ResultadoCertidao = (typeof RESULTADOS_CERTIDAO)[number];

export const RESULTADO_CERTIDAO_LABELS: Record<ResultadoCertidao, string> = {
  nao_classificado: "Não classificado",
  negativa: "Negativa",
  positiva: "Positiva",
  positiva_efeito_negativa: "Positiva com efeitos de negativa",
  sem_certidao_valida: "Sem certidão válida",
  indisponivel: "Serviço indisponível",
  erro: "Erro na consulta",
};

export const TIPOS_ARQUIVO_CERTIDAO = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export type MimeCertidao = (typeof TIPOS_ARQUIVO_CERTIDAO)[number];

export function detectarTipoArquivoCertidao(bytes: Uint8Array, mimeType: string): "pdf" | "imagem" | null {
  if (mimeType === "application/pdf" && bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "pdf";
  }
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.length >= 12
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50;
  if ((mimeType === "image/png" && png) || (mimeType === "image/jpeg" && jpeg) || (mimeType === "image/webp" && webp)) {
    return "imagem";
  }
  return null;
}

export function nomeArquivoSeguro(nome: string): string {
  const limpo = nome.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  return limpo.replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 180) || "evidencia";
}

export function statusFinalDoResultado(resultado: ResultadoCertidao) {
  if (resultado === "indisponivel") return "indisponivel" as const;
  if (resultado === "erro") return "erro" as const;
  return "concluida" as const;
}
