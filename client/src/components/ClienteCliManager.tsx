import React, { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FileText,
  Trash2,
  RefreshCw,
  ExternalLink,
  Upload,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  XCircle,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDate, calcDiasParaVencimento } from "@/lib/alvaras";
import StatusBadge from "@/components/StatusBadge";

interface Props {
  clienteId: number;
}

function getSituacaoBadge(situacaoCli: string | null | undefined) {
  if (!situacaoCli) return null;
  if (situacaoCli === "completo")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">
        <ShieldCheck className="h-2.5 w-2.5" /> CLI Completo
      </span>
    );
  if (situacaoCli === "parcial")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
        <ShieldAlert className="h-2.5 w-2.5" /> CLI Parcial
      </span>
    );
  return null;
}

function getPendenciasCount(cliOrgaosPendentes: string | null | undefined): number {
  if (!cliOrgaosPendentes) return 0;
  try {
    const arr: any[] = JSON.parse(cliOrgaosPendentes);
    return arr.filter((o) => o.status === "pendente").length;
  } catch {
    return 0;
  }
}

export default function ClienteCliManager({ clienteId }: Props) {
  const utils = trpc.useUtils();
  const { data: alvaras, isLoading } = trpc.alvaras.list.useQuery({ clienteId });

  // Estado de re-upload por alvará
  const [reuploadId, setReuploadId] = useState<number | null>(null);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadBase64, setReuploadBase64] = useState("");
  const [reuploadExtracted, setReuploadExtracted] = useState<any>(null);
  const [reuploadStep, setReuploadStep] = useState<"select" | "review">("select");
  const [reuploadPdfUrl, setReuploadPdfUrl] = useState<string | null>(null);
  const [reuploadPdfKey, setReuploadPdfKey] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const deleteMutation = trpc.alvaras.delete.useMutation({
    onSuccess: () => {
      toast.success("CLI removido com sucesso.");
      utils.alvaras.list.invalidate({ clienteId });
      utils.clientes.listComCobertura.invalidate();
    },
    onError: (e) => toast.error("Erro ao excluir: " + e.message),
  });

  const parsePdfMutation = trpc.importacao.parsePdf.useMutation({
    onSuccess: async (data) => {
      // Fazer upload do PDF ao storage S3
      try {
        const resp = await fetch("/api/upload-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileBase64: reuploadBase64, fileName: reuploadFile?.name ?? "cli.pdf" }),
        });
        if (resp.ok) {
          const { key, url } = await resp.json();
          setReuploadPdfKey(key);
          setReuploadPdfUrl(url);
          setReuploadExtracted({ ...data, arquivoPdfKey: key, arquivoPdfUrl: url });
        } else {
          setReuploadExtracted(data);
        }
      } catch {
        setReuploadExtracted(data);
      }
      setReuploadStep("review");
    },
    onError: (e) => toast.error("Erro ao ler PDF: " + e.message),
  });

  const confirmarPdfMutation = trpc.importacao.confirmarPdf.useMutation({
    onSuccess: () => {
      toast.success("CLI atualizado com sucesso!");
      setReuploadId(null);
      setReuploadFile(null);
      setReuploadBase64("");
      setReuploadExtracted(null);
      setReuploadPdfKey(null);
      setReuploadPdfUrl(null);
      setReuploadStep("select");
      utils.alvaras.list.invalidate({ clienteId });
      utils.clientes.listComCobertura.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setReuploadFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setReuploadBase64(base64);
      parsePdfMutation.mutate({ fileBase64: base64, fileName: f.name });
    };
    reader.readAsDataURL(f);
  };

  const handleDelete = (alvaraId: number, tipo: string) => {
    if (!confirm(`Confirma a exclusão do ${tipo}? Esta ação não pode ser desfeita.`)) return;
    deleteMutation.mutate({ id: alvaraId });
  };

  const startReupload = (alvaraId: number) => {
    setReuploadId(alvaraId);
    setReuploadStep("select");
    setReuploadFile(null);
    setReuploadExtracted(null);
    // Trigger file input after state update
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const cancelReupload = () => {
    setReuploadPdfKey(null);
    setReuploadPdfUrl(null);
    setReuploadId(null);
    setReuploadFile(null);
    setReuploadBase64("");
    setReuploadExtracted(null);
    setReuploadStep("select");
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const cliList = alvaras ?? [];

  if (cliList.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
          <FileText className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground font-medium">Nenhum CLI ou alvará cadastrado</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Importe o PDF do CLI ou alvará para registrar automaticamente as informações de licenciamento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Input de arquivo oculto (compartilhado) */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      {cliList.map(({ alvara }) => {
        const dias = calcDiasParaVencimento(alvara.dataVencimento);
        const pendencias = getPendenciasCount((alvara as any).cliOrgaosPendentes);
        const isExpanded = expandedId === alvara.id;
        const isReuploadTarget = reuploadId === alvara.id;

        return (
          <Card
            key={alvara.id}
            className={`border shadow-sm transition-all ${
              (alvara as any).situacaoCli === "parcial"
                ? "border-amber-200 bg-amber-50/30"
                : "border-border"
            }`}
          >
            <CardContent className="p-4 space-y-3">
              {/* Linha principal */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Tipo + número */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{alvara.tipo}</span>
                    {alvara.numeroAlvara && (
                      <span className="text-xs font-mono text-muted-foreground">Nº {alvara.numeroAlvara}</span>
                    )}
                    {getSituacaoBadge((alvara as any).situacaoCli)}
                    {pendencias > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                        <AlertTriangle className="h-2.5 w-2.5" /> {pendencias} órgão{pendencias !== 1 ? "s" : ""} pendente{pendencias !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Órgão emissor */}
                  {alvara.orgaoEmissor && (
                    <p className="text-xs text-muted-foreground">{alvara.orgaoEmissor}</p>
                  )}

                  {/* Datas + status */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Vencimento: <span className="font-medium text-foreground ml-0.5">{formatDate(alvara.dataVencimento)}</span>
                    </div>
                    <StatusBadge status={alvara.status} dataVencimento={alvara.dataVencimento} />
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Ver PDF */}
                  {(alvara as any).arquivoPdfUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 gap-1.5 text-xs"
                      title="Visualizar PDF"
                      onClick={() => window.open((alvara as any).arquivoPdfUrl, "_blank")}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Ver PDF</span>
                    </Button>
                  )}

                  {/* Atualizar CLI */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 gap-1.5 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                    title="Atualizar CLI com novo PDF"
                    disabled={parsePdfMutation.isPending && isReuploadTarget}
                    onClick={() => startReupload(alvara.id)}
                  >
                    {parsePdfMutation.isPending && isReuploadTarget
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <Upload className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">Atualizar</span>
                  </Button>

                  {/* Expandir detalhes */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    title="Ver detalhes"
                    onClick={() => setExpandedId(isExpanded ? null : alvara.id)}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>

                  {/* Excluir */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    title="Excluir CLI"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDelete(alvara.id, alvara.tipo)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Painel expandido com detalhes */}
              {isExpanded && (
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {alvara.dataEmissao && (
                      <>
                        <span className="text-muted-foreground">Data de Emissão:</span>
                        <span className="font-medium">{formatDate(alvara.dataEmissao)}</span>
                      </>
                    )}
                    {(alvara as any).cliNumeroSolicitacao && (
                      <>
                        <span className="text-muted-foreground">Nº Solicitação:</span>
                        <span className="font-mono font-medium">{(alvara as any).cliNumeroSolicitacao}</span>
                      </>
                    )}
                    {(alvara as any).cliInscricaoMunicipal && (
                      <>
                        <span className="text-muted-foreground">Inscrição Municipal:</span>
                        <span className="font-medium">{(alvara as any).cliInscricaoMunicipal}</span>
                      </>
                    )}
                    {(alvara as any).cliFormaAtuacao && (
                      <>
                        <span className="text-muted-foreground">Forma de Atuação:</span>
                        <span className="font-medium">{(alvara as any).cliFormaAtuacao}</span>
                      </>
                    )}
                    {dias !== null && (
                      <>
                        <span className="text-muted-foreground">Dias para vencimento:</span>
                        <span className={`font-bold ${dias < 0 ? "text-red-600" : dias <= 30 ? "text-amber-600" : "text-green-600"}`}>
                          {dias < 0 ? `Vencido há ${Math.abs(dias)} dias` : dias === 0 ? "Vence hoje" : `${dias} dias`}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Órgãos pendentes expandidos */}
                  {pendencias > 0 && (alvara as any).cliOrgaosPendentes && (() => {
                    try {
                      const orgaos: any[] = JSON.parse((alvara as any).cliOrgaosPendentes);
                      const pendentes = orgaos.filter((o) => o.status === "pendente");
                      return (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                          <p className="text-xs font-semibold text-amber-800">Órgãos com pendência:</p>
                          {pendentes.map((o) => (
                            <div key={o.orgao} className="flex items-start gap-2">
                              <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-amber-900">{o.orgao}</p>
                                <p className="text-xs text-amber-700">{o.tipoManifestacao}</p>
                              </div>
                            </div>
                          ))}
                          <p className="text-xs text-amber-600 italic">
                            Acesse o detalhe do alvará para resolver cada pendência individualmente.
                          </p>
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  {/* Link para detalhe */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 text-xs h-8"
                    onClick={() => window.location.assign(`/alvaras/${alvara.id}`)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir Detalhe Completo do Alvará
                  </Button>
                </div>
              )}

              {/* Mini-fluxo de re-upload */}
              {isReuploadTarget && reuploadStep === "review" && reuploadExtracted && (
                <div className="pt-2 border-t border-blue-200 space-y-3">
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Confirmar Atualização do CLI</p>
                  {reuploadPdfUrl && (
                    <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-xs text-emerald-700 flex-1">PDF salvo no storage</span>
                      <a href={reuploadPdfUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900">
                        Visualizar
                      </a>
                    </div>
                  )}
                  <div className="rounded-lg bg-white border border-blue-200 p-3 space-y-1.5 text-xs">
                    <p className="font-semibold text-blue-700 mb-1.5">Dados extraídos do novo PDF:</p>
                    {reuploadExtracted.razaoSocial && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Empresa:</span>
                        <span className="font-medium text-right truncate max-w-[60%]">{reuploadExtracted.razaoSocial}</span>
                      </div>
                    )}
                    {reuploadExtracted.numeroAlvara && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Número:</span>
                        <span className="font-mono font-medium">{reuploadExtracted.numeroAlvara}</span>
                      </div>
                    )}
                    {reuploadExtracted.dataVencimento && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Nova validade:</span>
                        <span className="font-medium text-green-700">{reuploadExtracted.dataVencimento}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Situação CLI:</span>
                      <span className={`font-bold ${
                        reuploadExtracted.situacaoCli === "completo" ? "text-green-600" : "text-amber-600"
                      }`}>
                        {reuploadExtracted.situacaoCli === "completo" ? "✓ Completo" : "⚠ Parcial"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white gap-1.5"
                      disabled={confirmarPdfMutation.isPending}
                      onClick={() =>
                        confirmarPdfMutation.mutate({
                          fileName: reuploadFile?.name ?? "cli.pdf",
                          dados: reuploadExtracted,
                        })
                      }
                    >
                      {confirmarPdfMutation.isPending
                        ? <><RefreshCw className="h-3 w-3 animate-spin" /> Salvando...</>
                        : <><CheckCircle2 className="h-3.5 w-3.5" /> Confirmar Atualização</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs px-3"
                      onClick={cancelReupload}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
