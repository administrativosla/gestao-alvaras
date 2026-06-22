/**
 * parseDate — Utilitário centralizado de parsing de datas para alvarás brasileiros.
 *
 * Formatos suportados:
 *   DD/MM/YYYY       → 31/12/2025
 *   DD/MM/YY         → 31/12/25   (ano 2000–2099)
 *   DD-MM-YYYY       → 31-12-2025
 *   DD-MM-YY         → 31-12-25
 *   DD.MM.YYYY       → 31.12.2025
 *   DD.MM.YY         → 31.12.25
 *   YYYY-MM-DD       → 2025-12-31  (ISO 8601)
 *   YYYY/MM/DD       → 2025/12/31
 *   YYYY.MM.DD       → 2025.12.31
 *   DD MM YYYY       → 31 12 2025  (espaço como separador)
 *   D/M/YYYY         → 1/1/2025    (dia/mês sem zero à esquerda)
 *   D-M-YYYY         → 1-1-2025
 *   YYYYMMDD         → 20251231    (compacto sem separador)
 *   DDMMYYYY         → 31122025    (compacto sem separador)
 *   Número serial do Excel (ex: 45657)
 *   Qualquer string que o Date nativo consiga interpretar como fallback
 */

export function parseDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  // Número serial do Excel (dias desde 1900-01-01, com correção do bug do ano bissexto de 1900)
  if (typeof val === "number" || (typeof val === "string" && /^\d{5}$/.test(val.trim()))) {
    const num = Number(val);
    if (!isNaN(num) && num > 25569 && num < 100000) {
      // 25569 = número serial de 1970-01-01
      const date = new Date((num - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) return date;
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // Remove sufixo de hora apenas quando o padrão é data+espaço+HH:MM (ex: "31/12/2025 00:00:00")
  // Não remove espaços que são separadores de data (ex: "31 12 2025")
  const strSemHora = str.replace(/[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/, "").trim();

  // Tabela de padrões: cada entrada é [regex, (match) => [ano, mes, dia]]
  const patterns: Array<[RegExp, (m: RegExpMatchArray) => [number, number, number]]> = [
    // DD/MM/YYYY ou D/M/YYYY
    [/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, (m) => [+m[3], +m[2], +m[1]]],
    // DD/MM/YY ou D/M/YY
    [/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, (m) => [expandYear(+m[3]), +m[2], +m[1]]],
    // DD-MM-YYYY ou D-M-YYYY
    [/^(\d{1,2})-(\d{1,2})-(\d{4})$/, (m) => [+m[3], +m[2], +m[1]]],
    // DD-MM-YY ou D-M-YY
    [/^(\d{1,2})-(\d{1,2})-(\d{2})$/, (m) => [expandYear(+m[3]), +m[2], +m[1]]],
    // DD.MM.YYYY ou D.M.YYYY
    [/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, (m) => [+m[3], +m[2], +m[1]]],
    // DD.MM.YY ou D.M.YY
    [/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/, (m) => [expandYear(+m[3]), +m[2], +m[1]]],
    // DD MM YYYY (espaço como separador — um ou mais espaços)
    [/^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/, (m) => [+m[3], +m[2], +m[1]]],
    // YYYY-MM-DD (ISO 8601)
    [/^(\d{4})-(\d{2})-(\d{2})$/, (m) => [+m[1], +m[2], +m[3]]],
    // YYYY/MM/DD
    [/^(\d{4})\/(\d{2})\/(\d{2})$/, (m) => [+m[1], +m[2], +m[3]]],
    // YYYY.MM.DD
    [/^(\d{4})\.(\d{2})\.(\d{2})$/, (m) => [+m[1], +m[2], +m[3]]],
    // YYYYMMDD (8 dígitos compacto, começa com 19 ou 20)
    [/^(19|20)(\d{2})(\d{2})(\d{2})$/, (m) => [+`${m[1]}${m[2]}`, +m[3], +m[4]]],
    // DDMMYYYY (8 dígitos compacto, dia entre 01-31)
    [/^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(\d{4})$/, (m) => [+m[3], +m[2], +m[1]]],
  ];

  for (const [regex, extractor] of patterns) {
    const m = strSemHora.match(regex);
    if (m) {
      const [year, month, day] = extractor(m);
      if (!isValidDateParts(year, month, day)) continue;
      // Constrói a data em UTC para evitar problemas de fuso horário
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Fallback: tenta o construtor nativo do Date
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/** Expande ano de 2 dígitos: 00–49 → 2000–2049, 50–99 → 1950–1999 */
function expandYear(yy: number): number {
  return yy <= 49 ? 2000 + yy : 1900 + yy;
}

/** Valida se os componentes formam uma data plausível */
function isValidDateParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;
  return true;
}

/**
 * Formata uma Date para string ISO (YYYY-MM-DD) para armazenamento.
 * Retorna null se a data for inválida.
 */
export function formatDateISO(date: Date | null | undefined): string | null {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

/**
 * Formata uma Date para exibição no padrão brasileiro (DD/MM/YYYY).
 */
export function formatDateBR(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return "";
  const d = date.getUTCDate().toString().padStart(2, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}
