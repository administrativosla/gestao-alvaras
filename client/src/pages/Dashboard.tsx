import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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

  const cards = [
    {
      title: "Total de Clientes",
      value: resumo?.totalClientes ?? 0,
      icon: Building2,
      color: "text-primary",
      bg: "bg-primary/8",
    },
    {
      title: "Alvarás Ativos",
      value: resumo?.alvarasAtivos ?? 0,
      icon: FileText,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "A Vencer em 30 dias",
      value: resumo?.aVencer30 ?? 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Alvarás Vencidos",
      value: resumo?.alvarasVencidos ?? 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Sem Registro",
      value: resumo?.totalSemRegistro ?? 0,
      icon: UserX,
      color: "text-violet-600",
      bg: "bg-violet-50",
      subtitle: "clientes sem alvará",
      link: "/clientes?cobertura=Sem+Registro",
    },
  ];

  const handleRefreshAll = () => {
    refetch();
    refetchProximos();
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral dos alvarás e alertas de vencimento
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefreshAll} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card) => (
          <Card
            key={card.title}
            className={`border shadow-sm hover:shadow-md transition-shadow ${'link' in card && card.link ? 'cursor-pointer' : ''}`}
            onClick={'link' in card && card.link ? () => setLocation(card.link!) : undefined}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {card.title}
                  </p>
                  {loadingResumo ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-3xl font-bold tracking-tight">{card.value}</p>
                  )}
                  {'subtitle' in card && card.subtitle && (
                    <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                  )}
                </div>
                <div className={`p-2.5 rounded-xl ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos analíticos */}
      <DashboardGraficos />

      {/* Painel de Alertas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Atenção Imediata
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Alvarás vencidos e a vencer em até 30 dias — requerem ação urgente
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/alvaras")} className="gap-1.5 text-xs">
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por razão social ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={filtroPrazo} onValueChange={setFiltroPrazo}>
            <SelectTrigger className="h-9 w-40 text-sm">
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
            <SelectTrigger className="h-9 w-48 text-sm">
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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : alertasFiltrados.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="p-3 rounded-full bg-emerald-50">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum alerta ativo no momento
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
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
      </div>

      {/* Próximos Vencimentos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-green-600" />
              Próximos Vencimentos
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Alvarás com mais de 30 dias para vencer, ordenados pelo mais próximo
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/alvaras")} className="gap-1.5 text-xs">
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Campo de busca nos próximos vencimentos */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por razão social ou CNPJ..."
            value={searchProximos}
            onChange={(e) => setSearchProximos(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {loadingProximos ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : !proximos || proximos.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="p-3 rounded-full bg-green-50">
                <ShieldCheck className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum alvará ativo cadastrado
              </p>
            </CardContent>
          </Card>
        ) : proximosFiltrados.length === 0 && searchProximos ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="p-3 rounded-full bg-muted">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum resultado para "{searchProximos}"</p>
              <Button variant="ghost" size="sm" onClick={() => setSearchProximos("")} className="text-xs">
                Limpar busca
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="pb-0 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
              {proximosFiltrados.length} alvará{proximosFiltrados.length !== 1 ? "s" : ""} ativo{proximosFiltrados.length !== 1 ? "s" : ""}{searchProximos && proximosFiltrados.length !== proximos!.length ? ` (de ${proximos!.length})` : ""}
            </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {proximosFiltrados.map((p, idx) => {
                  const prazoLabel = (() => {
                    if (p.diasParaVencimento < 0) return `Vencido há ${Math.abs(p.diasParaVencimento)} dia${Math.abs(p.diasParaVencimento) !== 1 ? "s" : ""}`;
                    if (p.diasParaVencimento === 0) return "Vence hoje";
                    if (p.diasParaVencimento <= 30) return `${p.diasParaVencimento} dia${p.diasParaVencimento !== 1 ? "s" : ""}`;
                    const meses = Math.floor(p.diasParaVencimento / 30);
                    const diasRestantes = p.diasParaVencimento % 30;
                    return meses > 0
                      ? `${meses} mês${meses > 1 ? "es" : ""}${diasRestantes > 0 ? ` e ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}` : ""}`
                      : `${p.diasParaVencimento} dias`;
                  })();

                  // Gradiente de cor conforme proximidade: verde → amarelo conforme se aproxima dos 30 dias
                  const urgencyRatio = Math.max(0, Math.min(1, 1 - (p.diasParaVencimento - 31) / 335)); // 0=longe, 1=próximo
                  const dotColor =
                    p.diasParaVencimento < 0
                      ? "bg-red-500"
                      : p.diasParaVencimento <= 7
                        ? "bg-red-400"
                        : p.diasParaVencimento <= 15
                          ? "bg-orange-400"
                          : p.diasParaVencimento <= 30
                            ? "bg-amber-400"
                            : p.diasParaVencimento <= 90
                              ? "bg-yellow-400"
                              : p.diasParaVencimento <= 180
                                ? "bg-teal-400"
                                : p.diasParaVencimento <= 365
                                  ? "bg-emerald-400"
                                  : "bg-green-400";

                  return (
                    <button
                      key={p.alvara.id}
                      onClick={() => setLocation(`/alvaras/${p.alvara.id}`)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left group"
                    >
                      {/* Posição */}
                      <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 text-center">
                        {idx + 1}
                      </span>

                      {/* Indicador de cor */}
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotColor}`} />

                      {/* Dados principais */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {p.cliente.razaoSocial}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.cliente.cnpj} · {p.alvara.tipo}
                          {p.alvara.numeroAlvara ? ` · Nº ${p.alvara.numeroAlvara}` : ""}
                        </p>
                      </div>

                      {/* Data de vencimento */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatDate(p.alvara.dataVencimento)}
                        </p>
                        <p className="text-xs text-muted-foreground">{prazoLabel}</p>
                      </div>

                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Seção CLI Parcial */}
      {(loadingCliParciais || (clisParciais && clisParciais.length > 0)) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                CLI Parcial — Pendentes de Regularização
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Certificados emitidos parcialmente que ainda não produzem efeitos legais completos
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/alvaras?situacaoCli=parcial")} className="gap-1.5 text-xs">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {loadingCliParciais ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : (
            <Card className="border border-amber-200 bg-amber-50/50 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="divide-y divide-amber-100">
                  {clisParciais!.map((cli) => (
                    <button
                      key={cli.id}
                      onClick={() => setLocation(`/alvaras/${cli.id}`)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-amber-100/60 transition-colors text-left group"
                    >
                      <div className="p-2 rounded-lg bg-amber-100 shrink-0">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-amber-700 transition-colors">
                          {cli.razaoSocial}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {cli.cnpj} · CLI · {cli.numeroAlvara ?? "Sem número"}
                        </p>
                        {cli.motivoPendenciaCli && (
                          <p className="text-xs text-amber-600 italic truncate mt-0.5">{cli.motivoPendenciaCli}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-200 text-amber-800 border border-amber-300">
                          CLI Parcial
                        </span>
                        {cli.dataVencimento && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Val. {formatDate(cli.dataVencimento)}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-amber-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
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
    <Card
      className={`border transition-all hover:shadow-md ${info.borderColor} ${info.bgColor}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Badge de urgência */}
          <div className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-xl ${info.color} ${info.pulse ? "alert-pulse" : ""}`}>
            <span className="text-white text-xs font-bold leading-tight text-center px-1">
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
                <p className="text-xs text-muted-foreground mt-0.5">
                  {alerta.cliente.cnpj} · {alerta.alvara.tipo}
                  {alerta.alvara.numeroAlvara && ` · Nº ${alerta.alvara.numeroAlvara}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                  {alerta.alvara.status}
                </span>
              </div>
            </div>

            {/* Barra de progresso de status */}
            <div className="mt-3">
              <StatusProgressBar status={alerta.alvara.status} compact />
            </div>

            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                Vencimento: <span className="font-medium">{formatDate(alerta.alvara.dataVencimento)}</span>
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
    statusEfetivo === "Renovado"
      ? "bg-emerald-500"
      : statusEfetivo === "Em Renovação"
        ? "bg-sky-500"
        : statusEfetivo === "Em Vigência"
          ? "bg-green-500"
          : statusEfetivo === "Iniciar Renovação"
            ? "bg-orange-500"
            : currentIndex >= 5
              ? "bg-violet-500"
              : currentIndex >= 3
                ? "bg-blue-500"
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
