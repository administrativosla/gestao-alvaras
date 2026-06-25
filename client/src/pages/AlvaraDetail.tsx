import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Pencil,
  FileText,
  Calendar,
  Building2,
  AlertCircle,
  ExternalLink,
  Clock,
  Download,
  User,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
  PhoneCall,
  Handshake,
  FolderOpen,
  RotateCcw,
  History,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  calcDiasParaVencimento,
  formatDate,
  formatCnpj,
  getAlertaInfo,
  STATUS_SEM_ALERTA,
  getStatusColor,
} from "@/lib/alvaras";
import StatusBadge from "@/components/StatusBadge";
import StatusUpdateDialog from "@/components/StatusUpdateDialog";
import { StatusProgressBar } from "./Dashboard";

interface Props {
  id: number;
}

// Ícone e cor por status
function getStatusIcon(status: string) {
  switch (status) {
    case "Em Vigência": return { Icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" };
    case "Vencido": return { Icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" };
    case "Contato Realizado": return { Icon: PhoneCall, color: "text-blue-600", bg: "bg-blue-100" };
    case "Tratativa Comercial": return { Icon: Handshake, color: "text-indigo-600", bg: "bg-indigo-100" };
    case "Documentação Solicitada": return { Icon: FolderOpen, color: "text-amber-600", bg: "bg-amber-100" };
    case "Em Renovação": return { Icon: RefreshCw, color: "text-sky-600", bg: "bg-sky-100" };
    case "Renovado": return { Icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" };
    case "Cancelado": return { Icon: XCircle, color: "text-rose-600", bg: "bg-rose-100" };
    default: return { Icon: RotateCcw, color: "text-slate-500", bg: "bg-slate-100" };
  }
}

export default function AlvaraDetail({ id }: Props) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.alvaras.get.useQuery({ id });
  const { data: historico, refetch: refetchHistorico } = trpc.alvaras.getHistorico.useQuery({ alvaraId: id });

  const exportHistoricoMutation = trpc.exportacao.historico.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${data.base64}`;
      link.download = data.fileName;
      link.click();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Alvará não encontrado</p>
        <Button variant="outline" onClick={() => setLocation("/alvaras")}>Voltar</Button>
      </div>
    );
  }

  const { alvara, cliente } = data;
  const dias = calcDiasParaVencimento(alvara.dataVencimento);
  const info = dias !== null ? getAlertaInfo(dias) : null;
  const alertaAtivo = !STATUS_SEM_ALERTA.includes(alvara.status as any) && dias !== null && dias <= 30;

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/alvaras")} className="h-9 w-9 mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{alvara.tipo}</h1>
              {alvara.numeroAlvara && (
                <span className="text-sm text-muted-foreground font-mono">Nº {alvara.numeroAlvara}</span>
              )}
            </div>
            <button
              onClick={() => setLocation(`/clientes/${cliente.id}`)}
              className="text-sm text-muted-foreground hover:text-primary hover:underline mt-0.5 text-left"
            >
              {cliente.razaoSocial} · {formatCnpj(cliente.cnpj)}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/alvaras/${id}/editar`)}
            className="gap-2"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Alerta de vencimento */}
          {alertaAtivo && info && dias !== null && (
            <Card className={`border ${info.borderColor} ${info.bgColor}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${info.color} ${info.pulse ? "alert-pulse" : ""}`}>
                  <AlertCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${info.textColor}`}>
                    {dias === 0
                      ? "Este alvará vence hoje!"
                      : dias < 0
                        ? `Este alvará venceu há ${Math.abs(dias)} dia(s)`
                        : `Este alvará vence em ${dias} dia(s)`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vencimento: {formatDate(alvara.dataVencimento)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dados do alvará */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dados do Alvará
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={FileText} label="Tipo" value={alvara.tipo} />
              {alvara.orgaoEmissor && (
                <InfoRow icon={Building2} label="Órgão Emissor" value={alvara.orgaoEmissor} />
              )}
              {alvara.dataEmissao && (
                <InfoRow icon={Calendar} label="Data de Emissão" value={formatDate(alvara.dataEmissao)} />
              )}
              <InfoRow
                icon={Calendar}
                label="Data de Vencimento"
                value={formatDate(alvara.dataVencimento)}
                highlight={alertaAtivo}
              />
              {alvara.arquivoPdfUrl && (
                <div className="flex items-center gap-2.5 pt-1">
                  <div className="p-1.5 rounded bg-red-100">
                    <FileText className="h-3.5 w-3.5 text-red-600" />
                  </div>
                  <a
                    href={alvara.arquivoPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Visualizar PDF do alvará <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico de movimentações — visual aprimorado */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Histórico de Movimentações
                  </CardTitle>
                  {historico && historico.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                      {historico.length}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => exportHistoricoMutation.mutate({ alvaraId: id })}
                  disabled={exportHistoricoMutation.isPending || !historico || historico.length === 0}
                >
                  <Download className="h-3 w-3" /> Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!historico || historico.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <div className="p-3 rounded-full bg-muted">
                    <History className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {historico.map((h: any, idx: number) => {
                    const { Icon, color, bg } = getStatusIcon(h.statusNovo);
                    const isFirst = idx === 0;
                    const isLast = idx === historico.length - 1;
                    const dataHora = new Date(h.createdAt);
                    const dataFormatada = dataHora.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                    const horaFormatada = dataHora.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div key={h.id} className="flex gap-4 group">
                        {/* Linha do tempo */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${bg} ring-2 ring-background ${isFirst ? "ring-primary/20" : ""}`}>
                            <Icon className={`h-4 w-4 ${color}`} />
                          </div>
                          {!isLast && (
                            <div className="w-px flex-1 bg-border mt-1 mb-1 min-h-[20px]" />
                          )}
                        </div>

                        {/* Conteúdo */}
                        <div className={`pb-5 min-w-0 flex-1 ${isFirst ? "pt-0" : ""}`}>
                          {/* Cabeçalho da movimentação */}
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{h.statusNovo}</span>
                              {h.statusAnterior && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {h.statusAnterior}
                                  </span>
                                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                              {isFirst && (
                                <Badge variant="outline" className="text-xs h-4 px-1.5 border-primary/30 text-primary">
                                  Mais recente
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                              <Clock className="h-3 w-3" />
                              <span>{dataFormatada} às {horaFormatada}</span>
                            </div>
                          </div>

                          {/* Responsável */}
                          {h.colaborador && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{h.colaborador}</span>
                            </div>
                          )}

                          {/* Observação */}
                          {h.observacao && (
                            <div className="mt-2 flex gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                              <p className="text-xs text-muted-foreground leading-relaxed">{h.observacao}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          {/* Status atual */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status de Renovação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusBadge status={alvara.status} dataVencimento={alvara.dataVencimento} />
              <StatusProgressBar status={alvara.status} dataVencimento={alvara.dataVencimento} />
              <StatusUpdateDialog
                alvaraId={id}
                statusAtual={alvara.status}
                onUpdated={() => {
                  refetch();
                  refetchHistorico();
                }}
                trigger={
                  <Button size="sm" className="w-full gap-2">
                    Atualizar Status
                  </Button>
                }
              />
            </CardContent>
          </Card>

          {/* Resumo do histórico */}
          {historico && historico.length > 0 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Última Atualização
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(() => {
                  const ultimo = historico[0];
                  const dataHora = new Date(ultimo.createdAt);
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const { Icon, color, bg } = getStatusIcon(ultimo.statusNovo);
                          return (
                            <div className={`p-1.5 rounded-lg ${bg}`}>
                              <Icon className={`h-3.5 w-3.5 ${color}`} />
                            </div>
                          );
                        })()}
                        <span className="text-sm font-medium">{ultimo.statusNovo}</span>
                      </div>
                      {ultimo.colaborador && (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{ultimo.colaborador}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {dataHora.toLocaleDateString("pt-BR")} às {dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: any;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground">{label}: </span>
        <span className={`text-sm font-medium ${highlight ? "text-red-600" : ""}`}>{value}</span>
      </div>
    </div>
  );
}
