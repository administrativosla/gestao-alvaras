import { getStatusColor } from "@/lib/alvaras";

export default function StatusBadge({ status }: { status: string }) {
  const colors = getStatusColor(status);
  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {status}
    </span>
  );
}
