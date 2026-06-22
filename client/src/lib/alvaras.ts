export const STATUS_RENOVACAO = [
  "Em Vigência",
  "Vencido",
  "Contato Realizado",
  "Tratativa Comercial",
  "Documentação Solicitada",
  "Em Renovação",
  "Renovado",
  "Cancelado",
] as const;

export type StatusRenovacao = (typeof STATUS_RENOVACAO)[number];

/** Status que cessam os alertas de vencimento (não aparecem no painel de urgência) */
export const STATUS_SEM_ALERTA: StatusRenovacao[] = [
  "Em Vigência",
  "Em Renovação",
  "Renovado",
  "Cancelado",
];

export const TIPOS_ALVARA = [
  "Funcionamento",
  "Sanitário",
  "Bombeiros",
  "Ambiental",
  "Publicidade",
  "Obras",
  "Outros",
] as const;

export function getStatusIndex(status: string): number {
  return STATUS_RENOVACAO.indexOf(status as StatusRenovacao);
}

export function getAlertaInfo(diasParaVencimento: number): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  pulse: boolean;
} {
  if (diasParaVencimento < 0) {
    return {
      label: "Vencido",
      color: "bg-slate-600",
      bgColor: "bg-slate-50",
      borderColor: "border-slate-300",
      textColor: "text-slate-700",
      pulse: false,
    };
  }
  if (diasParaVencimento <= 1) {
    return {
      label: diasParaVencimento === 0 ? "Vence hoje" : "1 dia",
      color: "bg-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-300",
      textColor: "text-red-800",
      pulse: true,
    };
  }
  if (diasParaVencimento <= 2) {
    return {
      label: "2 dias",
      color: "bg-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-700",
      pulse: true,
    };
  }
  if (diasParaVencimento <= 3) {
    return {
      label: "3 dias",
      color: "bg-red-500",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-700",
      pulse: false,
    };
  }
  if (diasParaVencimento <= 7) {
    return {
      label: `${diasParaVencimento} dias`,
      color: "bg-orange-500",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      textColor: "text-orange-700",
      pulse: false,
    };
  }
  if (diasParaVencimento <= 15) {
    return {
      label: `${diasParaVencimento} dias`,
      color: "bg-amber-500",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-700",
      pulse: false,
    };
  }
  return {
    label: `${diasParaVencimento} dias`,
    color: "bg-yellow-400",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    textColor: "text-yellow-700",
    pulse: false,
  };
}

export function getStatusColor(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case "Em Vigência":
      return { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" };
    case "Vencido":
      return { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300" };
    case "Contato Realizado":
      return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
    case "Tratativa Comercial":
      return { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" };
    case "Documentação Solicitada":
      return { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" };
    case "Em Renovação":
      return { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" };
    case "Renovado":
      return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    case "Cancelado":
      return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" };
  }
}

export function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function calcDiasParaVencimento(dataVencimento: Date | string | null | undefined): number | null {
  if (!dataVencimento) return null;
  const venc = dataVencimento instanceof Date ? dataVencimento : new Date(dataVencimento);
  if (isNaN(venc.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  venc.setHours(0, 0, 0, 0);
  return Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Determina o status inicial de um alvará com base na data de vencimento.
 * - Se vencer em mais de 30 dias → "Em Vigência"
 * - Se vencer em 30 dias ou menos (mas ainda não venceu) → "Vencido"
 * - Se já venceu → "Vencido" (para chamar atenção)
 */
export function getStatusInicial(dataVencimento: Date | string | null | undefined): StatusRenovacao {
  const dias = calcDiasParaVencimento(dataVencimento);
  if (dias === null) return "Vencido";
  return dias > 30 ? "Em Vigência" : "Vencido";
}
