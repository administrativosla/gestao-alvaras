import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import React from "react";
import {
  ArrowLeft,
  Pencil,
  FileText,
  Calendar,
  Building2,
  AlertCircle,
  AlertTriangle,
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
  ShieldCheck,
  ListChecks,
  CircleDot,
  CheckCheck,
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


// ─── Card de pendências por órgão no CLI parcial ────────────────────────────
interface OrgaoPendente {
  orgao: string;
  tipoManifestacao: string;
  status: "pendente" | "resolvido";
  resolvidoEm?: string | null;
  resolvidoPor?: string | null;
  observacao?: string | null;
}

function CliPendenciasCard({
  alvaraId,
  orgaosPendentes,
  onUpdated,
}: {
  alvaraId: number;
  orgaosPendentes: OrgaoPendente[];
  onUpdated: () => void;
}) {
  const [resolvendoOrgao, setResolvendoOrgao] = React.useState<string | null>(null);
  const [obsMap, setObsMap] = React.useState<Record<string, string>>({});
  const [uploadMode, setUploadMode] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadBase64, setUploadBase64] = React.useState("");
  const [uploadExtracted, setUploadExtracted] = React.useState<any>(null);
  const [uploadStep, setUploadStep] = React.useState<"select" | "review" | "done">("select");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const parsePdfMutation = trpc.importacao.parsePdf.useMutation({
    onSuccess: (data) => { setUploadExtracted(data); setUploadStep("review"); },
    onError: (e) => toast.error("Erro ao ler PDF: " + e.message),
  });

  const confirmarPdfMutation = trpc.importacao.confirmarPdf.useMutation({
    onSuccess: () => {
      toast.success("CLI definitivo importado! Cobertura atualizada.");
      setUploadMode(false);
      setUploadStep("select");
      setUploadFile(null);
      setUploadBase64("");
      setUploadExtracted(null);
      onUpdated();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setUploadBase64(base64);
      parsePdfMutation.mutate({ fileBase64: base64, fileName: f.name });
    };
    reader.readAsDataURL(f);
  };

  const desfazerMutation = trpc.alvaras.desfazerResolucaoOrgao.useMutation({
    onSuccess: () => {
      toast.success("Resolução desfeita. Órgão voltou para pendente.");
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });

  const resolverMutation = trpc.alvaras.resolverPendenciaOrgao.useMutation({
    onSuccess: (result) => {
      setResolvendoOrgao(null);
      if (result.todosResolvidos) {
        toast.success("Todos os órgãos resolvidos! Considere marcar o CLI como completo.");
      } else {
        toast.success("Pendência marcada como resolvida.");
      }
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPendentes = orgaosPendentes.filter((o) => o.status === "pendente").length;
  const totalResolvidos = orgaosPendentes.filter((o) => o.status === "resolvido").length;
  const total = orgaosPendentes.length;
  const todosResolvidos = total > 0 && totalPendentes === 0;

  return (
    <Card className={`shadow-sm transition-all duration-500 ${
      todosResolvidos
        ? "border-2 border-green-400 bg-green-50"
        : "border border-amber-300 bg-amber-50"
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${
              todosResolvidos ? "bg-green-500" : "bg-amber-500"
            }`}>
              <ListChecks className="h-3.5 w-3.5 text-white" />
            </div>
            <CardTitle className={`text-xs font-semibold uppercase tracking-wider ${
              todosResolvidos ? "text-green-800" : "text-amber-800"
            }`}>
              {todosResolvidos ? "Órgãos — Todos Resolvidos" : "Pendências por Órgão"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {totalPendentes > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full">
                <CircleDot className="h-3 w-3" />{totalPendentes} pendente{totalPendentes !== 1 ? "s" : ""}
              </span>
            )}
            {totalResolvidos > 0 && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                todosResolvidos
                  ? "text-green-700 bg-green-200"
                  : "text-green-700 bg-green-100"
              }`}>
                <CheckCheck className="h-3 w-3" />{totalResolvidos}/{total}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {orgaosPendentes.map((orgao) => {
          const isPendente = orgao.status === "pendente";
          const isResolvendo = resolvendoOrgao === orgao.orgao;
          return (
            <div
              key={orgao.orgao}
              className={`rounded-xl border-2 p-4 space-y-3 transition-all ${
                isPendente
                  ? "bg-white border-amber-300 shadow-sm"
                  : "bg-green-50/60 border-green-200"
              }`}
            >
              {/* Cabeçalho do órgão */}
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                  isPendente ? "bg-amber-400" : "bg-green-500"
                }`}>
                  {isPendente
                    ? <CircleDot className="h-3 w-3 text-white" />
                    : <CheckCheck className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1">
                  {/* Nome completo do órgão — sem truncamento */}
                  <p className={`text-sm font-semibold leading-snug ${
                    isPendente ? "text-amber-900" : "text-green-800"
                  }`}>{orgao.orgao}</p>
                  {/* Tipo de manifestação / o que precisa ser feito */}
                  <p className={`text-xs mt-1 leading-relaxed ${
                    isPendente ? "text-amber-700" : "text-green-600"
                  }`}>
                    <span className="font-medium">O que fazer:</span> {orgao.tipoManifestacao}
                  </p>
                  {/* Informações de resolução */}
                  {!isPendente && (
                    <div className="mt-1.5 space-y-0.5">
                      {orgao.resolvidoPor && (
                        <p className="text-xs text-green-600">
                          ✓ Resolvido por <span className="font-medium">{orgao.resolvidoPor}</span>
                          {orgao.resolvidoEm ? ` em ${new Date(orgao.resolvidoEm).toLocaleDateString("pt-BR")}` : ""}
                        </p>
                      )}
                      {orgao.observacao && (
                        <p className="text-xs text-green-600 italic">"{orgao.observacao}"</p>
                      )}
                    </div>
                  )}
                </div>
                {/* Badge de status */}
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPendente
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-green-100 text-green-700 border border-green-300"
                }`}>
                  {isPendente ? "PENDENTE" : "RESOLVIDO"}
                </span>
              </div>

              {/* Botão resolver (quando não está no modo de confirmação) */}
              {isPendente && !isResolvendo && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs border-amber-400 text-amber-800 hover:bg-amber-50 gap-1.5"
                  onClick={() => setResolvendoOrgao(orgao.orgao)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como Resolvido
                </Button>
              )}

              {/* Botão desfazer (para órgãos já resolvidos) */}
              {!isPendente && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[11px] border-green-300 text-green-700 hover:bg-green-50 hover:border-red-300 hover:text-red-600 gap-1.5 transition-colors"
                  disabled={desfazerMutation.isPending}
                  onClick={() => desfazerMutation.mutate({ alvaraId, orgao: orgao.orgao })}
                >
                  {desfazerMutation.isPending
                    ? <><RefreshCw className="h-3 w-3 animate-spin" /> Desfazendo...</>
                    : <><RotateCcw className="h-3 w-3" /> Desfazer Resolução</>}
                </Button>
              )}

              {/* Formulário de confirmação */}
              {isResolvendo && (
                <div className="space-y-2.5 pt-1 border-t border-amber-200">
                  <p className="text-xs text-amber-700 font-medium">Adicione uma observação (opcional):</p>
                  <textarea
                    rows={2}
                    placeholder="Ex: Licença emitida em 15/07/2026, protocolo nº 12345..."
                    className="w-full text-xs rounded-lg border border-amber-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    value={obsMap[orgao.orgao] ?? ""}
                    onChange={(e) => setObsMap((m) => ({ ...m, [orgao.orgao]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-xs px-3 flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5"
                      disabled={resolverMutation.isPending}
                      onClick={() =>
                        resolverMutation.mutate({
                          alvaraId,
                          orgao: orgao.orgao,
                          observacao: obsMap[orgao.orgao] || undefined,
                        })
                      }
                    >
                      {resolverMutation.isPending
                        ? <><RefreshCw className="h-3 w-3 animate-spin" /> Salvando...</>
                        : <><CheckCircle2 className="h-3.5 w-3.5" /> Confirmar Resolução</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs px-3"
                      onClick={() => setResolvendoOrgao(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {orgaosPendentes.length === 0 && (
          <div className="text-center py-4 space-y-1">
            <ListChecks className="h-8 w-8 text-amber-300 mx-auto" />
            <p className="text-sm text-amber-700 font-medium">Nenhuma pendência identificada</p>
            <p className="text-xs text-amber-600">
              Re-importe o CLI para detectar automaticamente os órgãos pendentes.
            </p>
          </div>
        )}

        {/* ─── Estado: TODOS RESOLVIDOS ─── */}
        {todosResolvidos && (
          <div className="mt-2 space-y-3">
            <div className="rounded-xl bg-green-100 border border-green-300 p-4 text-center space-y-1.5">
              <CheckCheck className="h-8 w-8 text-green-500 mx-auto" />
              <p className="text-sm font-semibold text-green-800">Todos os órgãos foram resolvidos!</p>
              <p className="text-xs text-green-700">
                O CLI está pronto para ser finalizado. Faça o upload do CLI definitivo ou marque-o como completo.
              </p>
            </div>

            {/* Mini-fluxo de upload do CLI definitivo */}
            {!uploadMode ? (
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => { setUploadMode(true); setUploadStep("select"); }}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Fazer Upload do CLI Definitivo
                </Button>
                <p className="text-[10px] text-green-600 text-center">
                  Ou use o botão "Marcar como Completo" abaixo se já recebeu o documento.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Upload do CLI Definitivo</p>
                  <button
                    className="text-xs text-blue-500 hover:text-blue-700"
                    onClick={() => { setUploadMode(false); setUploadStep("select"); setUploadFile(null); setUploadExtracted(null); }}
                  >Cancelar</button>
                </div>

                {uploadStep === "select" && (
                  <div className="space-y-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                      disabled={parsePdfMutation.isPending}
                      onClick={() => fileRef.current?.click()}
                    >
                      {parsePdfMutation.isPending
                        ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Lendo PDF...</>
                        : <><FileText className="h-3.5 w-3.5" /> Selecionar PDF do CLI</>}
                    </Button>
                    {uploadFile && !parsePdfMutation.isPending && (
                      <p className="text-xs text-blue-600 text-center">{uploadFile.name}</p>
                    )}
                  </div>
                )}

                {uploadStep === "review" && uploadExtracted && (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-white border border-blue-200 p-3 space-y-1.5 text-xs">
                      <p className="font-semibold text-blue-800 mb-2">Dados extraídos do PDF:</p>
                      {uploadExtracted.razaoSocial && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Empresa:</span>
                          <span className="font-medium text-right">{uploadExtracted.razaoSocial}</span>
                        </div>
                      )}
                      {uploadExtracted.numeroAlvara && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Número:</span>
                          <span className="font-medium font-mono">{uploadExtracted.numeroAlvara}</span>
                        </div>
                      )}
                      {uploadExtracted.dataVencimento && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Validade:</span>
                          <span className="font-medium">{uploadExtracted.dataVencimento}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Situação CLI:</span>
                        <span className={`font-bold ${
                          uploadExtracted.situacaoCli === "completo" ? "text-green-600" : "text-amber-600"
                        }`}>
                          {uploadExtracted.situacaoCli === "completo" ? "✓ Completo" : "⚠ Parcial"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white gap-1.5"
                        disabled={confirmarPdfMutation.isPending}
                        onClick={() => confirmarPdfMutation.mutate({
                          fileName: uploadFile?.name ?? "cli.pdf",
                          dados: uploadExtracted,
                        })}
                      >
                        {confirmarPdfMutation.isPending
                          ? <><RefreshCw className="h-3 w-3 animate-spin" /> Salvando...</>
                          : <><CheckCircle2 className="h-3.5 w-3.5" /> Confirmar e Salvar</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs px-3"
                        onClick={() => { setUploadStep("select"); setUploadFile(null); setUploadExtracted(null); }}
                      >
                        Trocar PDF
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Card de ação rápida: marcar CLI como completo ─────────────────────────────
function CliCompletarCard({ alvaraId, onUpdated }: { alvaraId: number; onUpdated: () => void }) {
  const updateMutation = trpc.alvaras.update.useMutation({
    onSuccess: () => {
      toast.success("CLI marcado como Completo! Cobertura atualizada automaticamente.");
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="border border-green-300 bg-green-50 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-green-500 shrink-0">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">CLI Parcial — Finalizar</p>
            <p className="text-xs text-green-700 mt-0.5">
              Recebeu o CLI definitivo? Marque como completo para atualizar a cobertura do cliente.
            </p>
            <Button
              size="sm"
              className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={updateMutation.isPending}
              onClick={() =>
                updateMutation.mutate({
                  id: alvaraId,
                  data: {
                    situacaoCli: "completo",
                    pendenciaRegularizacao: false,
                    motivoPendenciaCli: null,
                  },
                })
              }
            >
              {updateMutation.isPending ? (
                <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Atualizando...</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Marcar como Completo</>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
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
              {alvara.tipo === "CLI" && (
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs font-semibold">
                  VRE/REDESIM SP
                </Badge>
              )}
              {(alvara as any).situacaoCli === "parcial" && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  CLI Parcial
                </Badge>
              )}
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
          {/* Alerta de CLI Parcial */}
          {(alvara as any).situacaoCli === "parcial" && (
            <Card className="border border-amber-300 bg-amber-50">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500 shrink-0">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">CLI Parcial — Pendente de Finalização</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Este certificado ainda não produz os efeitos legais completos. É necessário finalizar as licenças dos órgãos integrados para obter o CLI definitivo.
                  </p>
                  {(alvara as any).motivoPendenciaCli && (
                    <p className="text-xs text-amber-600 mt-1 italic">{(alvara as any).motivoPendenciaCli}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
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

              {/* Campos específicos do CLI */}
              {alvara.tipo === "CLI" && (
                <>
                  {(alvara.cliProtocolo || alvara.cliNumeroSolicitacao || alvara.cliDataSolicitacao) && (
                    <div className="mt-4 pt-3 border-t space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Solicitação CLI</p>
                      {alvara.cliProtocolo && <InfoRow icon={FileText} label="Protocolo SPM" value={alvara.cliProtocolo} />}
                      {alvara.cliNumeroSolicitacao && <InfoRow icon={FileText} label="Nº Solicitação" value={alvara.cliNumeroSolicitacao} />}
                      {alvara.cliDataSolicitacao && <InfoRow icon={Calendar} label="Data Solicitação" value={formatDate(alvara.cliDataSolicitacao)} />}
                    </div>
                  )}
                  {(alvara.cliInscricaoMunicipal || alvara.cliNaturezaJuridica || alvara.cliFormaAtuacao || alvara.cliAreaEstabelecimento) && (
                    <div className="mt-2 pt-3 border-t space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Dados da Empresa</p>
                      {alvara.cliInscricaoMunicipal && <InfoRow icon={Building2} label="Inscrição Municipal" value={alvara.cliInscricaoMunicipal} />}
                      {alvara.cliNaturezaJuridica && <InfoRow icon={Building2} label="Natureza Jurídica" value={alvara.cliNaturezaJuridica} />}
                      {alvara.cliFormaAtuacao && <InfoRow icon={Building2} label="Forma de Atuação" value={alvara.cliFormaAtuacao} />}
                      {alvara.cliAreaEstabelecimento && <InfoRow icon={Building2} label="Área" value={alvara.cliAreaEstabelecimento} />}
                      {alvara.cliCnaesLicenciados && <InfoRow icon={FileText} label="CNAEs Licenciados" value={alvara.cliCnaesLicenciados} />}
                    </div>
                  )}
                  {alvara.cliComponentes && (() => {
                    try {
                      const comps = JSON.parse(alvara.cliComponentes) as Array<{
                        orgao: string; tipoManifestacao: string; numeroDocumento: string;
                        dataEmissao: string; dataValidade: string; cnaes: string; restricoes: string;
                      }>;
                      if (comps.length === 0) return null;
                      return (
                        <div className="mt-2 pt-3 border-t space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Componentes por Órgão</p>
                          {comps.map((c, i) => (
                            <div key={i} className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-blue-800">{c.orgao}</span>
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">{c.tipoManifestacao}</Badge>
                              </div>
                              {c.numeroDocumento && <p className="text-xs text-muted-foreground">Nº: <span className="font-mono">{c.numeroDocumento}</span></p>}
                              {c.dataValidade && <p className="text-xs text-muted-foreground">Validade: <span className="font-medium">{formatDate(c.dataValidade)}</span></p>}
                              {c.cnaes && <p className="text-xs text-muted-foreground">CNAEs: {c.cnaes}</p>}
                              {c.restricoes && <p className="text-xs text-muted-foreground">Restrições: {c.restricoes}</p>}
                            </div>
                          ))}
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </>
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
          {/* CLI Parcial — painel de pendências por órgão */}
          {(alvara as any).situacaoCli === "parcial" && (() => {
            let orgaos: OrgaoPendente[] = [];
            try {
              if ((alvara as any).cliOrgaosPendentes) {
                orgaos = JSON.parse((alvara as any).cliOrgaosPendentes);
              }
            } catch { /* ignore */ }
            return (
              <CliPendenciasCard
                alvaraId={id}
                orgaosPendentes={orgaos}
                onUpdated={() => { refetch(); refetchHistorico(); }}
              />
            );
          })()}

          {/* CLI Parcial — ação rápida para marcar como completo */}
          {(alvara as any).situacaoCli === "parcial" && (
            <CliCompletarCard alvaraId={id} onUpdated={() => { refetch(); refetchHistorico(); }} />
          )}

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
