import { getStatusColor, getStatusEfetivo } from "@/lib/alvaras";

interface StatusBadgeProps {
  status: string;
  dataVencimento?: Date | string | null;
}

export default function StatusBadge({ status, dataVencimento }: StatusBadgeProps) {
  const { label, variante } = getStatusEfetivo(status, dataVencimento);
  const colors = getStatusColor(label, variante);
  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {label}
    </span>
  );
}
