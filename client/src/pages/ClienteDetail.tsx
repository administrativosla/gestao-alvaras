import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  FileText,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  ExternalLink,
  Briefcase,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Scale,
  Landmark,
  Hash,
} from "lucide-react";
import { useLocation } from "wouter";
import { formatCnpj, formatDate, calcDiasParaVencimento, getAlertaInfo } from "@/lib/alvaras";
import StatusBadge from "@/components/StatusBadge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import NegociacaoCard from "@/components/NegociacaoCard";
import ClienteCliManager from "@/components/ClienteCliManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  id: number;
}

// ─── Badge de Situação Cadastral ──────────────────────────────────────────────
function SituacaoBadge({ situacao }: { situacao: string | null | undefined }) {
  if (!situacao) return null;
  const s = situacao.toUpperCase();
  if (s === "ATIVA") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
        <CheckCircle2 className="h-3 w-3" /> Ativa
      </span>
    );
  }
  if (s === "BAIXADA") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border border-red-300 text-red-700 bg-red-50 dark:bg-red-950/30">
        <XCircle className="h-3 w-3" /> Baixada
      </span>
    );
  }
  if (s === "SUSPENSA") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30">
        <AlertTriangle className="h-3 w-3" /> Suspensa
      </span>
    );
  }
  if (s === "INAPTA") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border border-orange-300 text-orange-700 bg-orange-50 dark:bg-orange-950/30">
        <AlertTriangle className="h-3 w-3" /> Inapta
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border border-slate-300 text-slate-600 bg-slate-50 dark:bg-slate-900/30">
      {situacao}
    </span>
  );
}

// ─── Badge de Cobertura ───────────────────────────────────────────────────────
function CoberturaBadge({ cobertura }: { cobertura: string }) {
  if (cobertura === "Sem Registro") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-violet-300 text-violet-600 bg-violet-50 dark:bg-violet-950/30">
      <ShieldOff className="h-3 w-3" /> Sem Registro
    </span>
  );
  if (cobertura === "Sem Alvará") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-slate-300 text-slate-500 bg-slate-50 dark:bg-slate-900/30">
      <ShieldOff className="h-3 w-3" /> Sem Alvará
    </span>
  );
  if (cobertura === "Parcial") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30">
      <ShieldAlert className="h-3 w-3" /> Cobertura Parcial
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
      <ShieldCheck className="h-3 w-3" /> Coberto
    </span>
  );
}

export default function ClienteDetail({ id }: Props) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.clientes.get.useQuery({ id });
  const { data: alvaras } = trpc.alvaras.list.useQuery({ clienteId: id });

  const toggleSemRegistroMutation = trpc.clientes.update.useMutation({
    onSuccess: () => {
      utils.clientes.get.invalidate({ id });
      utils.clientes.listComCobertura.invalidate();
    },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });

  const reenriquecerMutation = trpc.clientes.reenriquecer.useMutation({
    onSuccess: () => {
      utils.clientes.get.invalidate({ id });
      toast.success("Dados da Receita Federal atualizados com sucesso.");
    },
    onError: (e) => toast.error("Erro ao atualizar dados: " + e.message),
  });

  const cobertura = (() => {
    if (data?.semRegistro) return "Sem Registro" as const;
    if (!alvaras || alvaras.length === 0) return "Sem Alvará" as const;
    const STATUS_COBERTOS = ["Em Vigência", "Em Renovação", "Renovado"];
    const ativos = alvaras.filter((a) => a.alvara.ativo);
    if (ativos.length === 0) return "Sem Alvará" as const;
    if (ativos.every((a) => STATUS_COBERTOS.includes(a.alvara.status))) return "Coberto" as const;
    return "Parcial" as const;
  })();

  // Parse CNAEs secundários do JSON
  const cnaesSecundarios: { codigo: string; descricao: string }[] = (() => {
    if (!data?.cnaesSecundarios) return [];
    try { return JSON.parse(data.cnaesSecundarios); } catch { return []; }
  })();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={() => setLocation("/clientes")}>Voltar</Button>
      </div>
    );
  }

  // Montar endereço para Google Maps
  const enderecoCompleto = [
    data.logradouro,
    data.numero && `${data.numero}`,
    data.bairro,
    data.cidade,
    data.uf,
    data.cep,
  ].filter(Boolean).join(", ");
  const mapsUrl = enderecoCompleto
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`
    : null;

  // Formatar capital social
  const capitalFormatado = data.capitalSocial
    ? Number(data.capitalSocial).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in-up">

      {/* ── CABEÇALHO ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/clientes")} className="h-9 w-9 mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{data.razaoSocial}</h1>
              <SituacaoBadge situacao={data.situacaoCadastral} />
              <CoberturaBadge cobertura={cobertura} />
            </div>
            {data.nomeFantasia && (
              <p className="text-sm text-muted-foreground mt-0.5">{data.nomeFantasia}</p>
            )}
            <p className="text-sm font-mono text-muted-foreground mt-1">{formatCnpj(data.cnpj)}</p>
            {data.dadosReceitaAtualizadoEm && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Receita atualizada em {new Date(data.dadosReceitaAtualizadoEm).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reenriquecerMutation.mutate({ id })}
            disabled={reenriquecerMutation.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reenriquecerMutation.isPending ? "animate-spin" : ""}`} />
            {reenriquecerMutation.isPending ? "Atualizando..." : "Atualizar Receita"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/clientes/${id}/editar`)}
            className="gap-2"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        </div>
      </div>

      {/* ── GRID PRINCIPAL: 4 BLOCOS ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* BLOCO 1 — Dados da Receita Federal */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5" /> Dados da Receita Federal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <InfoRow icon={Hash} label="CNPJ" value={formatCnpj(data.cnpj)} mono />
            {data.inscricaoEstadual && <InfoRow icon={FileText} label="IE" value={data.inscricaoEstadual} />}
            {data.inscricaoMunicipal && <InfoRow icon={FileText} label="IM" value={data.inscricaoMunicipal} />}
            {data.dataAbertura && (
              <InfoRow icon={Calendar} label="Abertura" value={formatDate(data.dataAbertura)} />
            )}
            {data.porte && <InfoRow icon={TrendingUp} label="Porte" value={data.porte} />}
            {data.naturezaJuridica && (
              <InfoRow icon={Scale} label="Natureza Jurídica" value={data.naturezaJuridica} />
            )}
            {capitalFormatado && (
              <InfoRow icon={Briefcase} label="Capital Social" value={capitalFormatado} />
            )}
            {!data.porte && !data.naturezaJuridica && !data.dataAbertura && (
              <p className="text-xs text-muted-foreground italic">Dados da Receita ainda não carregados</p>
            )}
          </CardContent>
        </Card>

        {/* BLOCO 2 — Endereço */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.logradouro ? (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {data.logradouro}{data.numero ? `, ${data.numero}` : ""}
                    {data.complemento ? ` — ${data.complemento}` : ""}
                  </p>
                  {data.bairro && <p className="text-xs text-muted-foreground">{data.bairro}</p>}
                  <p className="text-xs text-muted-foreground">
                    {[
                      data.cidade && data.uf ? `${data.cidade} / ${data.uf}` : data.cidade,
                      data.cep && `CEP ${data.cep}`,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver no Google Maps
                  </a>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">Endereço ainda não carregado da Receita</p>
            )}
            <Separator className="my-2" />
            {/* Contato */}
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Contato</p>
            {data.nomeContato && <InfoRow icon={Building2} label="Responsável" value={data.nomeContato} />}
            {data.telefone && <InfoRow icon={Phone} label="Telefone" value={data.telefone} />}
            {data.email && <InfoRow icon={Mail} label="E-mail" value={data.email} />}
            {!data.nomeContato && !data.telefone && !data.email && (
              <p className="text-xs text-muted-foreground italic">Nenhum contato cadastrado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PAINEL RÁPIDO DE ALVARÁS — logo após os dados principais */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Alvarás
              {alvaras && alvaras.length > 0 && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5 ml-1">{alvaras.length}</Badge>
              )}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLocation(`/importar?clienteId=${id}`)}
              className="gap-1.5 h-7 text-xs"
            >
              <Plus className="h-3 w-3" /> Importar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {!alvaras || alvaras.length === 0 ? (
            <div className="flex items-center gap-3 py-4 text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0" />
              <p className="text-sm">Nenhum alvará cadastrado</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {alvaras.map((a) => {
                const dias = calcDiasParaVencimento(a.alvara.dataVencimento);
                const info = dias !== null ? getAlertaInfo(dias) : null;
                return (
                  <div
                    key={a.alvara.id}
                    className="flex items-center justify-between gap-3 py-2.5 cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded transition-colors"
                    onClick={() => setLocation(`/alvaras/${a.alvara.id}`)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="shrink-0">
                        <StatusBadge status={a.alvara.status} dataVencimento={a.alvara.dataVencimento} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {a.alvara.tipo}
                          {a.alvara.numeroAlvara && (
                            <span className="ml-1.5 text-xs text-muted-foreground font-normal font-mono">Nº {a.alvara.numeroAlvara}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {a.alvara.orgaoEmissor && (
                            <span className="text-xs text-muted-foreground truncate max-w-[180px]">{a.alvara.orgaoEmissor}</span>
                          )}
                          {a.alvara.dataVencimento && (
                            <span className="text-xs text-muted-foreground">
                              Venc. {formatDate(a.alvara.dataVencimento)}
                              {dias !== null && info && (
                                <span className={`ml-1 font-medium ${info.textColor}`}>({info.label})</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(a.alvara as any).arquivoPdfUrl && (
                        <a
                          href={(a.alvara as any).arquivoPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" /> PDF
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* BLOCO 3 — Atividades Econômicas (CNAEs) */}
      {(data.cnaePrincipal || cnaesSecundarios.length > 0) && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Atividades Econômicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* CNAE Principal */}
            {data.cnaePrincipal && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="default" className="text-xs font-mono shrink-0">
                      {data.cnaePrincipal}
                    </Badge>
                    <span className="text-xs font-semibold text-primary">Principal</span>
                  </div>
                  {data.cnaePrincipalDescricao && (
                    <p className="text-sm mt-1 text-foreground">{data.cnaePrincipalDescricao}</p>
                  )}
                </div>
              </div>
            )}

            {/* CNAEs Secundários */}
            {cnaesSecundarios.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {cnaesSecundarios.length} atividade{cnaesSecundarios.length > 1 ? "s" : ""} secundária{cnaesSecundarios.length > 1 ? "s" : ""}
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {cnaesSecundarios.map((cnae, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-border/50 last:border-0">
                      <Badge variant="outline" className="text-xs font-mono shrink-0 mt-0.5">
                        {cnae.codigo}
                      </Badge>
                      <p className="text-xs text-muted-foreground">{cnae.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── PAINEL COMERCIAL (coluna lateral) ─────────────────────────────────── */}
      {/* Observações preventivas — largura total, só renderiza se houver conteúdo */}
      {data.observacoesPreventivas && (
        <Card className="border shadow-sm border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Observações Preventivas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{data.observacoesPreventivas}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
          {/* Pipeline Comercial — oculto quando há alvará/CLI ativo */}
          {(!alvaras || alvaras.length === 0) && (
            <NegociacaoCard clienteId={id} />
          )}

          {/* Status Comercial */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status Comercial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor={`sem-registro-${id}`} className="text-sm font-medium cursor-pointer">
                    Sem Registro
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Marque quando não há CLI/alvará disponível para oferta comercial
                  </p>
                </div>
                <Switch
                  id={`sem-registro-${id}`}
                  checked={data?.semRegistro ?? false}
                  disabled={toggleSemRegistroMutation.isPending}
                  onCheckedChange={(checked) =>
                    toggleSemRegistroMutation.mutate({ id, data: { semRegistro: checked } })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* E-mails de alerta */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                E-mails de Alerta
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.emailsAlerta && data.emailsAlerta.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.emailsAlerta.map((email) => (
                    <Badge key={email} variant="secondary" className="font-normal text-xs">
                      {email}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum e-mail cadastrado</p>
              )}
            </CardContent>
          </Card>

      </div>{/* fim space-y-4 comercial */}

      {/* BLOCO 4 — Alvarás e CLIs */}
      <Tabs defaultValue="alvaras" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="h-9">
            <TabsTrigger value="alvaras" className="text-xs px-4">Alvarás</TabsTrigger>
            <TabsTrigger value="clis" className="text-xs px-4">Gerenciar CLIs</TabsTrigger>
          </TabsList>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation(`/importar?clienteId=${id}`)}
            className="gap-2"
          >
            <Plus className="h-3.5 w-3.5" /> Importar PDF
          </Button>
        </div>

        <TabsContent value="alvaras" className="mt-0 space-y-3">
          {!alvaras || alvaras.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhum alvará cadastrado para este cliente</p>
                <Button size="sm" variant="outline" onClick={() => setLocation(`/importar?clienteId=${id}`)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Importar PDF
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {alvaras.map((a) => {
                const dias = calcDiasParaVencimento(a.alvara.dataVencimento);
                const info = dias !== null ? getAlertaInfo(dias) : null;
                return (
                  <Card
                    key={a.alvara.id}
                    className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setLocation(`/alvaras/${a.alvara.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{a.alvara.tipo}</p>
                            {a.alvara.numeroAlvara && (
                              <span className="text-xs text-muted-foreground">Nº {a.alvara.numeroAlvara}</span>
                            )}
                          </div>
                          {a.alvara.orgaoEmissor && (
                            <p className="text-xs text-muted-foreground mt-0.5">{a.alvara.orgaoEmissor}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Vencimento: <span className="font-medium">{formatDate(a.alvara.dataVencimento)}</span>
                            {dias !== null && info && (
                              <span className={`ml-2 font-medium ${info.textColor}`}>
                                ({info.label})
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(a.alvara as any).arquivoPdfUrl && (
                            <a
                              href={(a.alvara as any).arquivoPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" /> PDF
                            </a>
                          )}
                          <StatusBadge status={a.alvara.status} dataVencimento={a.alvara.dataVencimento} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="clis" className="mt-0">
          <ClienteCliManager clienteId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground">{label}: </span>
        <span className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
      </div>
    </div>
  );
}
