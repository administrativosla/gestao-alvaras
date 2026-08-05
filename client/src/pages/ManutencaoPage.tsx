/**
 * ManutencaoPage.tsx — Painel de Manutenção do Sistema
 *
 * Acessível apenas para usuários MASTER.
 * Permite executar varreduras retroativas e revalidações em lote,
 * garantindo que melhorias aplicadas ao sistema sejam propagadas
 * para todos os registros existentes no banco.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw, FileSearch, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Clock, Database, Zap, Info
} from "lucide-react";
import { toast } from "sonner";

export default function ManutencaoPage() {
  const { user } = useAuth();
  const [logReprocessar, setLogReprocessar] = useState<any[]>([]);
  const [logRevalidar, setLogRevalidar] = useState<any[]>([]);
  const [resumoReprocessar, setResumoReprocessar] = useState<any>(null);
  const [resumoRevalidar, setResumoRevalidar] = useState<any>(null);

  // Verificação de acesso
  if (!user || (user as any).nivel < 3) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <ShieldCheck className="w-12 h-12 opacity-30" />
        <p className="text-lg font-medium">Acesso restrito a usuários MASTER</p>
      </div>
    );
  }

  const { data: status, isLoading: loadingStatus, refetch: refetchStatus } =
    trpc.admin.statusVarredura.useQuery();

  const reprocessarMutation = trpc.admin.reprocessarPdfs.useMutation({
    onSuccess: (data) => {
      setResumoReprocessar(data.resumo);
      setLogReprocessar(data.log);
      refetchStatus();
      toast.success(`Reprocessamento concluído: ${data.resumo.atualizados} atualizado(s)`);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const revalidarMutation = trpc.admin.revalidarTodos.useMutation({
    onSuccess: (data) => {
      setResumoRevalidar(data.resumo);
      setLogRevalidar(data.log);
      refetchStatus();
      toast.success(`Revalidação concluída: ${data.resumo.ok} alvarás revalidados`);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const statusIcon = (s: string) => {
    if (s === "ok") return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    if (s === "sem_mudanca") return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    return <XCircle className="w-3.5 h-3.5 text-red-500" />;
  };

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="w-6 h-6 text-primary" />
          Manutenção do Sistema
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Varredura retroativa e enriquecimento automático dos registros existentes.
          Aplique melhorias ao banco sem precisar reimportar documentos.
        </p>
      </div>

      {/* Aviso informativo */}
      <div className="flex gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Skill permanente:</strong> Toda nova melhoria aplicada ao sistema (novos campos extraídos,
          novas regras de validação) é automaticamente propagada para os registros existentes através
          das rotinas abaixo. Execute-as após cada atualização do sistema.
        </div>
      </div>

      {/* Estatísticas do banco */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Estado atual do banco</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetchStatus()} disabled={loadingStatus}>
              <RefreshCw className={`w-4 h-4 ${loadingStatus ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {status ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{status.total}</div>
                <div className="text-xs text-muted-foreground mt-1">Total de alvarás</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-green-600">{status.comPdf}</div>
                <div className="text-xs text-muted-foreground mt-1">Com PDF armazenado</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-muted-foreground">{status.semPdf}</div>
                <div className="text-xs text-muted-foreground mt-1">Sem PDF</div>
              </div>
              <div className={`text-center p-3 rounded-lg ${status.cliSemMunicipio > 0 ? "bg-orange-50 dark:bg-orange-950/30" : "bg-muted/50"}`}>
                <div className={`text-2xl font-bold ${status.cliSemMunicipio > 0 ? "text-orange-600" : ""}`}>
                  {status.cliSemMunicipio}
                </div>
                <div className="text-xs text-muted-foreground mt-1">CLI sem município emissor</div>
                {status.cliSemMunicipio > 0 && (
                  <Badge variant="outline" className="mt-1 text-xs text-orange-600 border-orange-300">
                    Reprocessar
                  </Badge>
                )}
              </div>
              <div className={`text-center p-3 rounded-lg ${status.semValidacao > 0 ? "bg-yellow-50 dark:bg-yellow-950/30" : "bg-muted/50"}`}>
                <div className={`text-2xl font-bold ${status.semValidacao > 0 ? "text-yellow-600" : ""}`}>
                  {status.semValidacao}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Sem validação</div>
                {status.semValidacao > 0 && (
                  <Badge variant="outline" className="mt-1 text-xs text-yellow-600 border-yellow-300">
                    Revalidar
                  </Badge>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className={`text-2xl font-bold ${status.precisaReprocessar === 0 && status.precisaRevalidar === 0 ? "text-green-600" : "text-primary"}`}>
                  {status.precisaReprocessar + status.precisaRevalidar}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Ações pendentes</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>
          )}
        </CardContent>
      </Card>

      {/* Ação 1: Reprocessar PDFs */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-primary" />
                Reprocessar PDFs armazenados
              </CardTitle>
              <CardDescription className="mt-1">
                Rele os PDFs do storage via IA e preenche campos faltantes (município emissor do CLI,
                CNAEs licenciados, situação do CLI). Não altera dados já preenchidos.
              </CardDescription>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => reprocessarMutation.mutate({ apenasCliSemMunicipio: true, limite: 50 })}
                disabled={reprocessarMutation.isPending}
              >
                {reprocessarMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Apenas CLI sem município
              </Button>
              <Button
                size="sm"
                onClick={() => reprocessarMutation.mutate({ apenasCliSemMunicipio: false, limite: 100 })}
                disabled={reprocessarMutation.isPending}
              >
                {reprocessarMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <FileSearch className="w-4 h-4 mr-2" />
                )}
                Reprocessar todos
              </Button>
            </div>
          </div>
        </CardHeader>
        {(resumoReprocessar || reprocessarMutation.isPending) && (
          <CardContent className="pt-0">
            <Separator className="mb-4" />
            {reprocessarMutation.isPending && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processando PDFs via IA... isso pode levar alguns minutos.
              </div>
            )}
            {resumoReprocessar && (
              <>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="font-bold">{resumoReprocessar.total}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center p-2 rounded bg-green-50 dark:bg-green-950/30">
                    <div className="font-bold text-green-600">{resumoReprocessar.atualizados}</div>
                    <div className="text-xs text-muted-foreground">Atualizados</div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="font-bold text-muted-foreground">{resumoReprocessar.semMudanca}</div>
                    <div className="text-xs text-muted-foreground">Sem mudança</div>
                  </div>
                  <div className="text-center p-2 rounded bg-red-50 dark:bg-red-950/30">
                    <div className="font-bold text-red-600">{resumoReprocessar.erros}</div>
                    <div className="text-xs text-muted-foreground">Erros</div>
                  </div>
                </div>
                {logReprocessar.length > 0 && (
                  <ScrollArea className="h-48 rounded border">
                    <div className="p-3 space-y-1">
                      {logReprocessar.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {statusIcon(item.status)}
                          <span className="text-muted-foreground">#{item.alvaraId}</span>
                          <span className="flex-1 truncate">{item.mensagem}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Ação 2: Revalidar Todos */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Revalidar conformidade com a Receita Federal
              </CardTitle>
              <CardDescription className="mt-1">
                Aplica as regras de validação mais recentes a todos os alvarás usando os dados
                já armazenados no banco. Não rele PDFs — ideal para aplicar correções na lógica
                de validação (como a correção do município emissor do CLI).
              </CardDescription>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => revalidarMutation.mutate({ apenasNaoValidados: true, limite: 200 })}
                disabled={revalidarMutation.isPending}
              >
                {revalidarMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Apenas sem validação
              </Button>
              <Button
                size="sm"
                onClick={() => revalidarMutation.mutate({ apenasNaoValidados: false, limite: 500 })}
                disabled={revalidarMutation.isPending}
              >
                {revalidarMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="w-4 h-4 mr-2" />
                )}
                Revalidar todos
              </Button>
            </div>
          </div>
        </CardHeader>
        {(resumoRevalidar || revalidarMutation.isPending) && (
          <CardContent className="pt-0">
            <Separator className="mb-4" />
            {revalidarMutation.isPending && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Revalidando alvarás...
              </div>
            )}
            {resumoRevalidar && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="font-bold">{resumoRevalidar.total}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center p-2 rounded bg-green-50 dark:bg-green-950/30">
                    <div className="font-bold text-green-600">{resumoRevalidar.ok}</div>
                    <div className="text-xs text-muted-foreground">Revalidados</div>
                  </div>
                  <div className="text-center p-2 rounded bg-red-50 dark:bg-red-950/30">
                    <div className="font-bold text-red-600">{resumoRevalidar.erros}</div>
                    <div className="text-xs text-muted-foreground">Erros</div>
                  </div>
                </div>
                {logRevalidar.length > 0 && (
                  <ScrollArea className="h-48 rounded border">
                    <div className="p-3 space-y-1">
                      {logRevalidar.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {item.status === "ok"
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            : <XCircle className="w-3.5 h-3.5 text-red-500" />
                          }
                          <span className="text-muted-foreground">#{item.alvaraId}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs px-1 py-0 ${
                              item.resultado === "ok" ? "text-green-600 border-green-300" :
                              item.resultado === "divergente" ? "text-red-600 border-red-300" :
                              "text-muted-foreground"
                            }`}
                          >
                            {item.resultado}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Guia de uso */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Quando executar cada rotina
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="flex gap-2">
            <FileSearch className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <span><strong>Reprocessar PDFs</strong> — após adicionar novos campos extraídos pelo LLM (ex: cliMunicipioEmissor). Rele os documentos e preenche o que estava faltando.</span>
          </div>
          <div className="flex gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <span><strong>Revalidar Todos</strong> — após corrigir regras de validação (ex: lógica de jurisdição). Aplica as novas regras sem precisar reler os PDFs.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
