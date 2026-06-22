import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { BarChart2, PieChart as PieChartIcon, CalendarDays } from "lucide-react";

// Paleta de cores para status
const STATUS_COLORS: Record<string, string> = {
  "Em Vigência": "#22c55e",
  "Vencido": "#ef4444",
  "Contato Realizado": "#3b82f6",
  "Tratativa Comercial": "#8b5cf6",
  "Documentação Solicitada": "#f59e0b",
  "Em Renovação": "#0ea5e9",
  "Renovado": "#10b981",
  "Cancelado": "#94a3b8",
};

// Paleta de cores para tipos
const TIPO_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#8b5cf6", "#0ea5e9", "#f97316",
];

function CustomTooltipStatus({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-foreground">{d.status}</p>
      <p className="text-muted-foreground">{d.total} alvará{d.total !== 1 ? "s" : ""}</p>
    </div>
  );
}

function CustomTooltipMensal({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill }} className="text-xs">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

function CustomLegendTipo({ payload }: any) {
  if (!payload) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
      {payload.map((entry: any, idx: number) => (
        <li key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
          {entry.value}
        </li>
      ))}
    </ul>
  );
}

export default function DashboardGraficos() {
  const { data: graficos, isLoading } = trpc.dashboard.graficos.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-64 col-span-1" />
        <Skeleton className="h-64 col-span-1" />
        <Skeleton className="h-64 col-span-1" />
      </div>
    );
  }

  if (!graficos) return null;

  const { distribuicaoStatus, distribuicaoTipo, vencimentosMensais } = graficos;

  const totalAlvaras = distribuicaoStatus.reduce((acc, d) => acc + d.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">Análise Visual</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Distribuição por Status (Barras horizontais) */}
        <Card className="border shadow-sm lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" />
              Distribuição por Status
            </CardTitle>
            <p className="text-xs text-muted-foreground">{totalAlvaras} alvarás no total</p>
          </CardHeader>
          <CardContent className="pt-0">
            {distribuicaoStatus.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                Sem dados disponíveis
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {distribuicaoStatus.map((d) => {
                  const pct = totalAlvaras > 0 ? Math.round((d.total / totalAlvaras) * 100) : 0;
                  const color = STATUS_COLORS[d.status] ?? "#94a3b8";
                  return (
                    <div key={d.status} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium truncate max-w-[140px]">{d.status}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">{d.total} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico 2: Distribuição por Tipo (Pizza) */}
        <Card className="border shadow-sm lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <PieChartIcon className="h-3.5 w-3.5" />
              Distribuição por Tipo
            </CardTitle>
            <p className="text-xs text-muted-foreground">{distribuicaoTipo.length} tipo{distribuicaoTipo.length !== 1 ? "s" : ""} cadastrado{distribuicaoTipo.length !== 1 ? "s" : ""}</p>
          </CardHeader>
          <CardContent className="pt-0">
            {distribuicaoTipo.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                Sem dados disponíveis
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={distribuicaoTipo}
                    dataKey="total"
                    nameKey="tipo"
                    cx="50%"
                    cy="45%"
                    outerRadius={70}
                    innerRadius={30}
                    paddingAngle={2}
                  >
                    {distribuicaoTipo.map((_, idx) => (
                      <Cell key={idx} fill={TIPO_COLORS[idx % TIPO_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border rounded-lg shadow-md px-3 py-2 text-sm">
                          <p className="font-semibold">{d.tipo}</p>
                          <p className="text-muted-foreground">{d.total} alvará{d.total !== 1 ? "s" : ""}</p>
                        </div>
                      );
                    }}
                  />
                  <Legend content={<CustomLegendTipo />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Gráfico 3: Vencimentos por Mês (Barras empilhadas) */}
        <Card className="border shadow-sm lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Vencimentos por Mês
            </CardTitle>
            <p className="text-xs text-muted-foreground">Últimos 13 meses (vencidos + a vencer)</p>
          </CardHeader>
          <CardContent className="pt-0">
            {vencimentosMensais.every((m) => m.total === 0) ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                Sem dados disponíveis
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={vencimentosMensais}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  barSize={14}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltipMensal />} />
                  <Bar dataKey="vencidos" name="Vencidos" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="aVencer" name="A Vencer" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500 shrink-0" />
                Vencidos
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0" />
                A Vencer
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
