import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import DashboardGraficos from "@/components/DashboardGraficos";
import {
  AlertTriangle,
  Building2,
  FileText,
  CheckCircle2,
  Clock,
  Search,
  ArrowRight,
  RefreshCw,
  CalendarClock,
  ShieldCheck,
  UserX,
  ExternalLink,
  TrendingUp,
  Activity,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { calcDiasParaVencimento, formatDate, getAlertaInfo, getStatusColor, getStatusEfetivo, STATUS_SEM_ALERTA } from "@/lib/alvaras";
import StatusUpdateDialog from "@/components/StatusUpdateDialog";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPrazo, setFiltroPrazo] = useState("todos");
  const [searchProximos, setSearchProximos] = useState("");

  const { data: resumo, isLoading: loadingResumo } = trpc.dashboard.resumo.useQuery();
  const { data: alertas, isLoading: loadingAlertas, refetch } = trpc.dashboard.alertas.useQuery();
  const { data: proximos, isLoading: loadingProximos, refetch: refetchProximos } = trpc.dashboard.proximosVencimentos.useQuery({ limite: 50 });
  const { data: clisParciais, isLoading: loadingCliParciais } = trpc.alvaras.listCliParciais.useQuery();

  const proximosFiltrados = (proximos ?? []).filter((p) =>
    !searchProximos ||
    p.cliente.razaoSocial.toLowerCase().includes(searchProximos.toLowerCase()) ||
    p.cliente.cnpj.includes(searchProximos)
  );

  const alertasFiltrados = (alertas ?? []).filter((a) => {
    const matchSearch =
      !search ||
      a.cliente.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
      a.cliente.cnpj.includes(search);
    const matchStatus = filtroStatus === "todos" || a.alvara.status === filtroStatus;
    const matchPrazo =
      filtroPrazo === "todos" ||
      (filtroPrazo === "7" && a.diasParaVencimento <= 7) ||
      (filtroPrazo === "15" && a.diasParaVencimento <= 15) ||
      (filtroPrazo === "30" && a.diasParaVencimento <= 30) ||
      (filtroPrazo === "vencido" && a.diasParaVencimento < 0);
    return matchSearch && matchStatus && matchPrazo;
  });

  const handleRefreshAll = () => {
    refetch();
    refetchProximos();
  };

  // KPIs compactos — 6 métricas em grid 2×3
  const kpis = [
    {
      title: "Clientes",
      value: resumo?.totalClientes ?? 0,
      icon: Building2,
      color: "text-primary",
      bg: "bg-primary/8",
      link: "/clientes",
    },
    {
      title: "Alvarás Ativos",
      value: resumo?.alvarasAtivos ?? 0,
      icon: FileText,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      link: "/alvaras",
    },
    {
      title: "A Vencer (30d)",
      value: resumo?.aVencer30 ?? 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      link: "/alvaras",
      urgent: (resumo?.aVencer30 ?? 0) > 0,
    },
    {
      title: "Vencidos",
      value: resumo?.alvarasVencidos ?? 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      link: "/alvaras",
      urgent: (resumo?.alvarasVencidos ?? 0) > 0,
    },
    {
      title: "Sem Registro",
      value: resumo?.totalSemRegistro ?? 0,
      icon: UserX,
      color: "text-violet-600",
      bg: "bg-violet-50",
      link: "/clientes?cobertura=Sem+Registro",
    },
    {
      title: "CLI Parcial",
      value: clisParciais?.length ?? 0,
      icon: Activity,
      color: "text-orange-600",
      bg: "bg-orange-50",
      link: "/alvaras?situacaoCli=parcial",
      urgent: (clisParciais?.length ?? 0) > 0,
    },
  ];

  const totalAlertas = alertasFiltrados.length;
  const totalVencidos = alertasFiltrados.filter((a) => a.diasParaVencimento < 0).length;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* ── Cabeçalho compacto ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Controle de alvarás e alertas de vencimento
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefreshAll} className="gap-2 h-8 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {/* ── KPIs compactos ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card
            key={kpi.title}
            className={`border shadow-sm hover:shadow-md transition-all cursor-pointer ${kpi.urgent ? "ring-1 ring-red-200" : ""}`}
            onClick={() => setLocation(kpi.link)}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
                  {kpi.title}
                </p>
                <div className={`p-1.5 rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                </div>
              </div>
              {loadingResumo || loadingCliParciais ? (
                <Skeleton className="h-7 w-10" />
              ) : (
                <p className={`text-2xl font-bold tracking-tight ${kpi.urgent ? "text-red-600" : ""}`}>
                  {kpi.value}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Layout de duas colunas: Alertas | Próximos ─────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* COLUNA ESQUERDA (3/5): Atenção Imediata */}
        <div className="xl:col-span-3 space-y-4">
          {/* Cabeçalho da seção */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-semibold tracking-tight">Atenção Imediata</h2>
              {!loadingAlertas && totalAlertas > 0 && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="destructive" className="text-xs h-5 px-1.5">{totalAlertas}</Badge>
                  {totalVencidos > 0 && (
                    <Badge variant="outline" className="text-xs h-5 px-1.5 border-red-300 text-red-600">
                      {totalVencidos} vencido{totalVencidos !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/alvaras")} className="gap-1 text-xs h-7">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          {/* Filtros compactos */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={filtroPrazo} onValueChange={setFiltroPrazo}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Prazo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os prazos</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                <SelectItem value="7">Até 7 dias</SelectItem>
                <SelectItem value="15">Até 15 dias</SelectItem>
                <SelectItem value="30">Até 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="Vencido">Vencido</SelectItem>
                <SelectItem value="Contato Realizado">Contato Realizado</SelectItem>
                <SelectItem value="Tratativa Comercial">Tratativa Comercial</SelectItem>
                <SelectItem value="Documentação Solicitada">Documentação Solicitada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista de alertas */}
          {loadingAlertas ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : alertasFiltrados.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="p-3 rounded-full bg-emerald-50">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhum alerta ativo</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {alertasFiltrados.map((a) => {
                const info = getAlertaInfo(a.diasParaVencimento);
                const statusColors = getStatusColor(a.alvara.status);
                return (
                  <AlertaCard
                    key={a.alvara.id}
                    alerta={a}
                    info={info}
                    statusColors={statusColors}
                    onNavigate={() => setLocation(`/alvaras/${a.alvara.id}`)}
                    onStatusUpdated={() => refetch()}
                  />
                );
              })}
            </div>
          )}

          {/* CLI Parcial — abaixo dos alertas */}
          {(loadingCliParciais || (clisParciais && clisParciais.length > 0)) && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold tracking-tight">CLI Parcial</h2>
                  {!loadingCliParciais && clisParciais && (
                    <Badge variant="outline" className="text-xs h-5 px-1.5 border-amber-300 text-amber-600">
                      {clisParciais.length}
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/alvaras?situacaoCli=parcial")} className="gap-1 text-xs h-7">
                  Ver todos <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
              {loadingCliParciais ? (
                <Skeleton className="h-16 w-full rounded-xl" />
              ) : (
                <Card className="border border-amber-200 bg-amber-50/50 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="divide-y divide-amber-100">
                      {clisParciais!.map((cli) => (
                        <button
                          key={cli.id}
                          onClick={() => setLocation(`/alvaras/${cli.id}`)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-100/60 transition-colors text-left group"
                        >
                          <div className="p-1.5 rounded-lg bg-amber-100 shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-amber-700 transition-colors">
                              {cli.razaoSocial}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {cli.cnpj} · CLI{cli.numeroAlvara ? ` · Nº ${cli.numeroAlvara}` : ""}
                              {cli.motivoPendenciaCli && ` · ${cli.motivoPendenciaCli}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {(cli as any).totalOrgaosPendentes > 0 && (
                              <span className="text-xs font-semibold text-amber-700">
                                {(cli as any).totalOrgaosPendentes} pend.
                              </span>
                            )}
                            {(cli as any).arquivoPdfUrl && (
                              <a
                                href={(cli as any).arquivoPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-2.5 w-2.5" /> PDF
                              </a>
                            )}
                            <ArrowRight className="h-3 w-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* COLUNA DIREITA (2/5): Próximos Vencimentos */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-green-600" />
              <h2 className="text-sm font-semibold tracking-tight">Próximos Vencimentos</h2>
              {!loadingProximos && proximosFiltrados.length > 0 && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5">{proximosFiltrados.length}</Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/alvaras")} className="gap-1 text-xs h-7">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar..."
              value={searchProximos}
              onChange={(e) => setSearchProximos(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {loadingProximos ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : !proximos || proximos.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="p-3 rounded-full bg-green-50">
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhum alvará ativo</p>
              </CardContent>
            </Card>
          ) : proximosFiltrados.length === 0 && searchProximos ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Sem resultados</p>
                <Button variant="ghost" size="sm" onClick={() => setSearchProximos("")} className="text-xs h-7">
                  Limpar
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {proximosFiltrados.map((p, idx) => {
                    const prazoLabel = (() => {
                      if (p.diasParaVencimento < 0) return `Vencido há ${Math.abs(p.diasParaVencimento)}d`;
                      if (p.diasParaVencimento === 0) return "Vence hoje";
                      if (p.diasParaVencimento <= 30) return `${p.diasParaVencimento}d`;
                      const meses = Math.floor(p.diasParaVencimento / 30);
                      const diasRestantes = p.diasParaVencimento % 30;
                      return meses > 0
                        ? `${meses}m${diasRestantes > 0 ? ` ${diasRestantes}d` : ""}`
                        : `${p.diasParaVencimento}d`;
                    })();

                    const dotColor =
                      p.diasParaVencimento < 0 ? "bg-red-500"
                        : p.diasParaVencimento <= 7 ? "bg-red-400"
                          : p.diasParaVencimento <= 15 ? "bg-orange-400"
                            : p.diasParaVencimento <= 30 ? "bg-amber-400"
                              : p.diasParaVencimento <= 90 ? "bg-yellow-400"
                                : p.diasParaVencimento <= 180 ? "bg-teal-400"
                                  : p.diasParaVencimento <= 365 ? "bg-emerald-400"
                                    : "bg-green-400";

                    return (
                      <button
                        key={p.alvara.id}
                        onClick={() => setLocation(`/alvaras/${p.alvara.id}`)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left group"
                      >
                        <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0 text-center">
                          {idx + 1}
                        </span>
                        <div className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                            {p.cliente.razaoSocial}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {p.alvara.tipo}{p.alvara.numeroAlvara ? ` · Nº ${p.alvara.numeroAlvara}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold tabular-nums">{formatDate(p.alvara.dataVencimento)}</p>
                          <p className={`text-[10px] font-medium ${p.diasParaVencimento <= 30 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {prazoLabel}
                          </p>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Gráficos analíticos ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight">Análise Visual</h2>
        </div>
        <DashboardGraficos />
      </div>
    </div>
  );
}

function AlertaCard({
  alerta,
  info,
  statusColors,
  onNavigate,
  onStatusUpdated,
}: {
  alerta: any;
  info: ReturnType<typeof getAlertaInfo>;
  statusColors: ReturnType<typeof getStatusColor>;
  onNavigate: () => void;
  onStatusUpdated: () => void;
}) {
  return (
    <Card className={`border transition-all hover:shadow-md ${info.borderColor} ${info.bgColor}`}>
      <CardContent className="p-3.5">
        <div className="flex items-start gap-3">
          {/* Badge de urgência compacto */}
          <div className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-lg ${info.color} ${info.pulse ? "alert-pulse" : ""}`}>
            <span className="text-white text-[10px] font-bold leading-tight text-center px-1">
              {info.label}
            </span>
          </div>

          {/* Informações */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <button
                  onClick={onNavigate}
                  className="text-sm font-semibold hover:underline truncate block text-left"
                >
                  {alerta.cliente.razaoSocial}
                </button>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {alerta.cliente.cnpj} · {alerta.alvara.tipo}
                  {alerta.alvara.numeroAlvara && ` · Nº ${alerta.alvara.numeroAlvara}`}
                </p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border shrink-0 ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                {alerta.alvara.status}
              </span>
            </div>

            {/* Barra de progresso compacta */}
            <div className="mt-2">
              <StatusProgressBar status={alerta.alvara.status} compact />
            </div>

            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-muted-foreground">
                Venc. <span className="font-medium">{formatDate(alerta.alvara.dataVencimento)}</span>
              </p>
              <StatusUpdateDialog
                alvaraId={alerta.alvara.id}
                statusAtual={alerta.alvara.status}
                onUpdated={onStatusUpdated}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusProgressBar({
  status,
  dataVencimento,
  compact = false,
}: {
  status: string;
  dataVencimento?: Date | string | null;
  compact?: boolean;
}) {
  const { label: statusEfetivo } = getStatusEfetivo(status, dataVencimento);

  const steps = [
    "Em Vigência",
    "Iniciar Renovação",
    "Vencido",
    "Contato Realizado",
    "Tratativa Comercial",
    "Documentação Solicitada",
    "Em Renovação",
    "Renovado",
  ];

  if (statusEfetivo === "Cancelado") {
    return (
      <div className={`flex items-center gap-1.5 ${compact ? "" : "py-1"}`}>
        <div className="h-1.5 flex-1 rounded-full bg-rose-200" />
        <span className="text-xs text-rose-600 font-medium">Cancelado</span>
      </div>
    );
  }

  const currentIndex = steps.indexOf(statusEfetivo);
  const progress = currentIndex === -1 ? 0 : ((currentIndex + 1) / steps.length) * 100;

  const progressColor =
    statusEfetivo === "Renovado" ? "bg-emerald-500"
      : statusEfetivo === "Em Renovação" ? "bg-sky-500"
        : statusEfetivo === "Em Vigência" ? "bg-green-500"
          : statusEfetivo === "Iniciar Renovação" ? "bg-orange-500"
            : currentIndex >= 5 ? "bg-violet-500"
              : currentIndex >= 3 ? "bg-blue-500"
                : "bg-slate-400";

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-black/8 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {currentIndex + 1}/{steps.length}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {currentIndex + 1}/{steps.length}
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {steps.map((step, idx) => (
          <div
            key={step}
            className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full transition-all ${
              idx < currentIndex
                ? "bg-primary/10 text-primary font-medium"
                : idx === currentIndex
                  ? `${progressColor} text-white font-semibold`
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
