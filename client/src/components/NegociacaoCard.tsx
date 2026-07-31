import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Phone,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  History,
  Plus,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type NegociacaoStatus =
  | "contato_realizado"
  | "proposta_recusada"
  | "proposta_aprovada"
  | "em_andamento"
  | "em_vigencia";

const STATUS_CONFIG: Record<
  NegociacaoStatus,
  { label: string; color: string; icon: React.ElementType; bg: string }
> = {
  contato_realizado: {
    label: "Contato Realizado",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30",
    icon: Phone,
  },
  proposta_recusada: {
    label: "Proposta Recusada",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200 dark:bg-red-950/30",
    icon: XCircle,
  },
  proposta_aprovada: {
    label: "Proposta Aprovada",
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30",
    icon: ThumbsUp,
  },
  em_andamento: {
    label: "Em Andamento",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30",
    icon: Clock,
  },
  em_vigencia: {
    label: "Em Vigência",
    color: "text-violet-600",
    bg: "bg-violet-50 border-violet-200 dark:bg-violet-950/30",
    icon: CheckCircle2,
  },
};

// Próximos status possíveis a partir de cada status
const PROXIMOS: Record<NegociacaoStatus, NegociacaoStatus[]> = {
  contato_realizado: ["proposta_aprovada", "proposta_recusada"],
  proposta_aprovada: ["em_andamento", "proposta_recusada"],
  em_andamento: ["em_vigencia", "proposta_recusada"],
  proposta_recusada: ["contato_realizado"],
  em_vigencia: [],
};

interface Props {
  clienteId: number;
}

export default function NegociacaoCard({ clienteId }: Props) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: negociacao, isLoading } = trpc.negociacoes.get.useQuery({ clienteId });
  const { data: historico } = trpc.negociacoes.listarHistorico.useQuery({ clienteId });

  const [showHistorico, setShowHistorico] = useState(false);
  const [showIniciarDialog, setShowIniciarDialog] = useState(false);
  const [showAvancarDialog, setShowAvancarDialog] = useState<NegociacaoStatus | null>(null);
  const [showEncerrarDialog, setShowEncerrarDialog] = useState(false);

  const [observacao, setObservacao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [dataContato, setDataContato] = useState(new Date().toISOString().slice(0, 10));
  const [statusInicialSelecionado, setStatusInicialSelecionado] = useState<NegociacaoStatus>("contato_realizado");

  const invalidate = () => {
    utils.negociacoes.get.invalidate({ clienteId });
    utils.negociacoes.listarHistorico.invalidate({ clienteId });
    utils.negociacoes.resumoPorStatus.invalidate();
  };

  const criarMutation = trpc.negociacoes.criar.useMutation({
    onSuccess: () => {
      toast.success("Negociação iniciada com sucesso!");
      setShowIniciarDialog(false);
      setObservacao("");
      setResponsavel("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const avancarMutation = trpc.negociacoes.avancarStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      setShowAvancarDialog(null);
      setObservacao("");
      setResponsavel("");
      invalidate();
    },
    onError: (e) => {
      if (e.message.includes("obrigatório cadastrar")) {
        toast.error(e.message, {
          action: {
            label: "Importar PDF",
            onClick: () => setLocation(`/importar?clienteId=${clienteId}`),
          },
          duration: 8000,
        });
      } else {
        toast.error(e.message);
      }
      setShowAvancarDialog(null);
    },
  });

  const encerrarMutation = trpc.negociacoes.encerrar.useMutation({
    onSuccess: () => {
      toast.success("Negociação encerrada.");
      setShowEncerrarDialog(false);
      setObservacao("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Negociação Comercial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const cfg = negociacao ? STATUS_CONFIG[negociacao.status as NegociacaoStatus] : null;
  const proximos = negociacao ? PROXIMOS[negociacao.status as NegociacaoStatus] : [];

  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Negociação Comercial
            </CardTitle>
            {negociacao && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => setShowHistorico(!showHistorico)}
              >
                <History className="h-3 w-3" />
                {showHistorico ? "Ocultar" : "Histórico"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!negociacao ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Nenhuma negociação ativa. Registre o status atual deste cliente no pipeline comercial.
              </p>
              {/* Seletor rápido de status inicial */}
              <div className="grid grid-cols-1 gap-1.5">
                {(Object.entries(STATUS_CONFIG) as [NegociacaoStatus, typeof STATUS_CONFIG[NegociacaoStatus]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setStatusInicialSelecionado(key);
                      setShowIniciarDialog(true);
                    }}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all hover:shadow-sm ${
                      key === "proposta_recusada"
                        ? "border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-950/20"
                        : cfg.bg
                    }`}
                  >
                    <cfg.icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground/50" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Status atual */}
              <div className={`rounded-lg border p-3 ${cfg?.bg}`}>
                <div className="flex items-center gap-2">
                  {cfg && <cfg.icon className={`h-4 w-4 ${cfg.color}`} />}
                  <span className={`text-sm font-semibold ${cfg?.color}`}>{cfg?.label}</span>
                </div>
                {negociacao.responsavel && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Responsável: {negociacao.responsavel}
                  </p>
                )}
                {negociacao.observacao && (
                  <p className="text-xs text-muted-foreground mt-0.5 italic">
                    "{negociacao.observacao}"
                  </p>
                )}
                {negociacao.dataContato && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Contato em:{" "}
                    {new Date(negociacao.dataContato).toLocaleDateString("pt-BR", {
                      timeZone: "UTC",
                    })}
                  </p>
                )}
              </div>

              {/* Alerta para em_vigencia sem alvará */}
              {negociacao.status === "em_vigencia" && (
                <div className="flex items-start gap-2 rounded-md bg-violet-50 border border-violet-200 p-2.5 dark:bg-violet-950/30">
                  <FileText className="h-3.5 w-3.5 text-violet-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-violet-700 font-medium">Alvará obrigatório</p>
                    <p className="text-xs text-violet-600 mt-0.5">
                      Cadastre o CLI ou alvará para gerar o acompanhamento de vencimento.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-6 text-xs gap-1 border-violet-300 text-violet-700 hover:bg-violet-100"
                      onClick={() => setLocation(`/importar?clienteId=${clienteId}`)}
                    >
                      <Plus className="h-3 w-3" /> Importar PDF do CLI
                    </Button>
                  </div>
                </div>
              )}

              {/* Ações de avanço */}
              {proximos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Avançar para:</p>
                  <div className="flex flex-col gap-1.5">
                    {proximos.map((prox) => {
                      const pcfg = STATUS_CONFIG[prox];
                      const isRecusa = prox === "proposta_recusada";
                      const isReabertura = prox === "contato_realizado";
                      return (
                        <Button
                          key={prox}
                          size="sm"
                          variant="outline"
                          className={`w-full justify-start gap-2 text-xs ${
                            isRecusa
                              ? "border-red-200 text-red-600 hover:bg-red-50"
                              : isReabertura
                              ? "border-blue-200 text-blue-600 hover:bg-blue-50"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                          onClick={() => setShowAvancarDialog(prox)}
                        >
                          {isRecusa ? (
                            <ThumbsDown className="h-3.5 w-3.5" />
                          ) : isReabertura ? (
                            <RotateCcw className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5" />
                          )}
                          {pcfg.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Encerrar negociação */}
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setShowEncerrarDialog(true)}
              >
                Encerrar negociação
              </Button>
            </div>
          )}

          {/* Histórico de movimentações */}
          {showHistorico && historico && historico.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Histórico
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {historico.map((h) => {
                  const novoLabel =
                    h.statusNovo === "encerrado"
                      ? "Encerrado"
                      : STATUS_CONFIG[h.statusNovo as NegociacaoStatus]?.label ?? h.statusNovo;
                  const anteriorLabel = h.statusAnterior
                    ? STATUS_CONFIG[h.statusAnterior as NegociacaoStatus]?.label ?? h.statusAnterior
                    : null;
                  return (
                    <div key={h.id} className="flex gap-2 text-xs">
                      <div className="w-1 bg-border rounded-full shrink-0 mt-1" />
                      <div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {anteriorLabel && (
                            <>
                              <span className="text-muted-foreground">{anteriorLabel}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            </>
                          )}
                          <span className="font-medium">{novoLabel}</span>
                        </div>
                        {h.responsavel && (
                          <span className="text-muted-foreground">por {h.responsavel}</span>
                        )}
                        {h.observacao && (
                          <p className="text-muted-foreground italic mt-0.5">"{h.observacao}"</p>
                        )}
                        <p className="text-muted-foreground/70 mt-0.5">
                          {new Date(h.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Iniciar negociação */}
      <Dialog open={showIniciarDialog} onOpenChange={(open) => {
        setShowIniciarDialog(open);
        if (!open) { setObservacao(""); setResponsavel(""); setDataContato(new Date().toISOString().slice(0, 10)); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Status de Negociação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Status selecionado */}
            <div>
              <Label className="text-xs text-muted-foreground">Status inicial</Label>
              <div className={`mt-1 flex items-center gap-2 rounded-lg border px-3 py-2 ${STATUS_CONFIG[statusInicialSelecionado].bg}`}>
                {(() => { const Ic = STATUS_CONFIG[statusInicialSelecionado].icon; return <Ic className={`h-4 w-4 ${STATUS_CONFIG[statusInicialSelecionado].color}`} />; })()}
                <span className={`text-sm font-semibold ${STATUS_CONFIG[statusInicialSelecionado].color}`}>
                  {STATUS_CONFIG[statusInicialSelecionado].label}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Nome do responsável"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Data do Contato / Registro</Label>
              <Input
                type="date"
                value={dataContato}
                onChange={(e) => setDataContato(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Descreva a situação atual..."
                className="mt-1 resize-none"
                rows={3}
              />
            </div>
            {statusInicialSelecionado === "em_vigencia" && (
              <div className="flex items-start gap-2 rounded-md bg-violet-50 border border-violet-200 p-2.5">
                <AlertTriangle className="h-3.5 w-3.5 text-violet-600 mt-0.5 shrink-0" />
                <p className="text-xs text-violet-700">
                  Para registrar "Em Vigência" é necessário ter pelo menos um CLI/alvará ativo cadastrado para este cliente.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIniciarDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                criarMutation.mutate({
                  clienteId,
                  responsavel: responsavel || undefined,
                  observacao: observacao || undefined,
                  dataContato,
                  statusInicial: statusInicialSelecionado,
                })
              }
              disabled={criarMutation.isPending}
            >
              {criarMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Avançar status */}
      {showAvancarDialog && (
        <Dialog open={!!showAvancarDialog} onOpenChange={() => setShowAvancarDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Avançar para: {STATUS_CONFIG[showAvancarDialog]?.label}
              </DialogTitle>
            </DialogHeader>
            {showAvancarDialog === "em_vigencia" && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Para confirmar "Em Vigência", o cliente deve ter pelo menos um CLI ou alvará
                  cadastrado no sistema.
                </p>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Responsável</Label>
                <Input
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  placeholder="Nome do responsável"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Observação</Label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Adicione uma observação sobre esta mudança..."
                  className="mt-1 resize-none"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAvancarDialog(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!negociacao) return;
                  avancarMutation.mutate({
                    negociacaoId: negociacao.id,
                    novoStatus: showAvancarDialog,
                    responsavel: responsavel || undefined,
                    observacao: observacao || undefined,
                  });
                }}
                disabled={avancarMutation.isPending}
              >
                {avancarMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* AlertDialog: Encerrar negociação */}
      <AlertDialog open={showEncerrarDialog} onOpenChange={setShowEncerrarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar negociação?</AlertDialogTitle>
            <AlertDialogDescription>
              A negociação será encerrada e não poderá ser retomada. Uma nova negociação poderá ser
              iniciada posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!negociacao) return;
                encerrarMutation.mutate({ negociacaoId: negociacao.id });
              }}
            >
              {encerrarMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
