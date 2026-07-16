import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  ThumbsUp,
  ThumbsDown,
  Clock,
  CheckCircle2,
  Building2,
  MapPin,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";
import { formatCnpj } from "@/lib/alvaras";

type NegociacaoStatus =
  | "contato_realizado"
  | "proposta_recusada"
  | "proposta_aprovada"
  | "em_andamento"
  | "em_vigencia";

const STATUS_CONFIG: Record<
  NegociacaoStatus,
  { label: string; color: string; badgeClass: string; icon: React.ElementType; headerBg: string }
> = {
  contato_realizado: {
    label: "Contato Realizado",
    color: "text-blue-600",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Phone,
    headerBg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30",
  },
  proposta_aprovada: {
    label: "Proposta Aprovada",
    color: "text-emerald-600",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: ThumbsUp,
    headerBg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30",
  },
  em_andamento: {
    label: "Em Andamento",
    color: "text-amber-600",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
    headerBg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30",
  },
  em_vigencia: {
    label: "Em Vigência",
    color: "text-violet-600",
    badgeClass: "bg-violet-100 text-violet-700 border-violet-200",
    icon: CheckCircle2,
    headerBg: "bg-violet-50 border-violet-200 dark:bg-violet-950/30",
  },
  proposta_recusada: {
    label: "Proposta Recusada",
    color: "text-red-600",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    icon: ThumbsDown,
    headerBg: "bg-red-50 border-red-200 dark:bg-red-950/30",
  },
};

// Ordem de exibição das colunas no pipeline
const PIPELINE_ORDER: NegociacaoStatus[] = [
  "contato_realizado",
  "proposta_aprovada",
  "em_andamento",
  "em_vigencia",
  "proposta_recusada",
];

export default function PipelineComercial() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<NegociacaoStatus | undefined>(undefined);

  const { data: resumo, isLoading: resumoLoading } = trpc.negociacoes.resumoPorStatus.useQuery();
  const { data: negociacoes, isLoading: listLoading, refetch } = trpc.negociacoes.list.useQuery({
    status: statusFiltro,
    page: 1,
    pageSize: 100,
  });

  const filtradas = negociacoes?.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.cliente.razaoSocial.toLowerCase().includes(q) ||
      n.cliente.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    );
  });

  // Agrupar por status
  const porStatus: Record<NegociacaoStatus, typeof filtradas> = {
    contato_realizado: [],
    proposta_aprovada: [],
    em_andamento: [],
    em_vigencia: [],
    proposta_recusada: [],
  };

  if (filtradas) {
    for (const n of filtradas) {
      const s = n.negociacao.status as NegociacaoStatus;
      if (porStatus[s]) porStatus[s]!.push(n);
    }
  }

  const totalAtivos =
    (resumo?.contato_realizado ?? 0) +
    (resumo?.proposta_aprovada ?? 0) +
    (resumo?.em_andamento ?? 0) +
    (resumo?.em_vigencia ?? 0);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline Comercial</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe o status das negociações com clientes sem alvará
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {PIPELINE_ORDER.map((s) => {
          const cfg = STATUS_CONFIG[s];
          const count = resumo?.[s] ?? 0;
          const isActive = statusFiltro === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFiltro(isActive ? undefined : s)}
              className={`text-left rounded-lg border p-3 transition-all hover:shadow-sm ${
                isActive ? cfg.headerBg + " ring-2 ring-offset-1 ring-current" : "bg-card border-border"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
              </div>
              <p className={`text-2xl font-bold ${cfg.color}`}>{resumoLoading ? "—" : count}</p>
            </button>
          );
        })}
      </div>

      {/* Busca */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar por razão social ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {(search || statusFiltro) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFiltro(undefined);
            }}
          >
            Limpar filtros
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          {totalAtivos} negociação{totalAtivos !== 1 ? "ões" : ""} ativa{totalAtivos !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Kanban / Colunas */}
      {listLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {PIPELINE_ORDER.map((s) => (
            <div key={s} className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {PIPELINE_ORDER.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const items = porStatus[s] ?? [];
            if (statusFiltro && statusFiltro !== s) return null;
            return (
              <div key={s} className="space-y-2">
                {/* Cabeçalho da coluna */}
                <div className={`rounded-lg border px-3 py-2 flex items-center justify-between ${cfg.headerBg}`}>
                  <div className="flex items-center gap-1.5">
                    <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <Badge variant="outline" className={`text-xs px-1.5 ${cfg.badgeClass}`}>
                    {items.length}
                  </Badge>
                </div>

                {/* Cards de negociação */}
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-xs text-muted-foreground">Nenhuma negociação</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((n) => (
                      <Card
                        key={n.negociacao.id}
                        className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setLocation(`/clientes/${n.cliente.id}`)}
                      >
                        <CardContent className="p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-xs font-semibold leading-snug line-clamp-2">
                              {n.cliente.razaoSocial}
                            </p>
                            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                          </div>
                          <p className="text-xs font-mono text-muted-foreground">
                            {formatCnpj(n.cliente.cnpj)}
                          </p>
                          {(n.cliente.municipio || n.cliente.estado) && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span>
                                {[n.cliente.municipio, n.cliente.estado]
                                  .filter(Boolean)
                                  .join(" / ")}
                              </span>
                            </div>
                          )}
                          {n.negociacao.responsavel && (
                            <p className="text-xs text-muted-foreground">
                              Resp.: {n.negociacao.responsavel}
                            </p>
                          )}
                          {n.negociacao.updatedAt && (
                            <p className="text-xs text-muted-foreground/70">
                              Atualizado:{" "}
                              {new Date(n.negociacao.updatedAt).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
