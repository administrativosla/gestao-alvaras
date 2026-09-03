import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileCheck2,
  FileClock,
  FileUp,
  Loader2,
  Search,
  ShieldCheck,
  UserRound,
  Bot,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  RECEITA_CERTIDOES_URL,
  RESULTADO_CERTIDAO_LABELS,
  type ResultadoCertidao,
} from "@shared/certidoes";

type OrigemConsulta = "consulta_anterior" | "nova_emissao_assistida";
const EXTENSION_CHANNEL = "mjp-cnd-v1";
const PORTAL_MESSAGE_SOURCE = "mjp-portal-controller";
const EXTENSION_MESSAGE_SOURCE = "mjp-cnd-extension";
const EXTENSION_DOWNLOAD_URL = "/manus-storage/mjp-controller-cnd-federal-extension-v0.3.0_84b64ba8.zip";

type ConsultaAtiva = {
  id: number;
  clienteId: number;
  clienteNome: string;
  cnpj: string;
  origem: OrigemConsulta;
  urlFonte: string;
};

type AutomacaoAtiva = ConsultaAtiva & {
  requestId: string;
};

const resultadosDisponiveis: ResultadoCertidao[] = [
  "negativa",
  "positiva",
  "positiva_efeito_negativa",
  "indisponivel",
  "erro",
];

function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function formatarDataHora(valor: Date | string | null | undefined) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function origemLabel(origem: OrigemConsulta) {
  return origem === "consulta_anterior" ? "Certidão já emitida" : "Nova emissão assistida";
}

export default function CertidoesDashboard() {
  const utils = trpc.useUtils();
  const [clienteId, setClienteId] = useState("");
  const [consultaAtiva, setConsultaAtiva] = useState<ConsultaAtiva | null>(null);
  const [resultado, setResultado] = useState<ResultadoCertidao>("negativa");
  const [mensagem, setMensagem] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [validadeAte, setValidadeAte] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [extensaoDisponivel, setExtensaoDisponivel] = useState(false);
  const [automacaoAtiva, setAutomacaoAtiva] = useState<AutomacaoAtiva | null>(null);
  const [automacaoMensagem, setAutomacaoMensagem] = useState("");
  const eventosFinalizados = useRef(new Set<string>());

  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("previewConsulta") === "1") {
      setConsultaAtiva({
        id: 0,
        clienteId: 0,
        clienteNome: "Empresa selecionada",
        cnpj: "00.000.000/0000-00",
        origem: "consulta_anterior",
        urlFonte: RECEITA_CERTIDOES_URL,
      });
    }
  }, []);

  const { data: clientes, isLoading: carregandoClientes } = trpc.clientes.listComCobertura.useQuery({});
  const { data: historico, isLoading: carregandoHistorico } = trpc.certidoes.list.useQuery({ limit: 100 });
  const iniciarMutation = trpc.certidoes.iniciar.useMutation();
  const registrarMutation = trpc.certidoes.registrarResultado.useMutation();
  const anexarMutation = trpc.certidoes.anexarVersao.useMutation();

  const clienteSelecionado = clientes?.find((cliente) => cliente.id === Number(clienteId));
  const consultasConcluidas = historico?.filter((item) => item.consulta.status === "concluida").length ?? 0;
  const documentosCaptados = historico?.reduce((total, item) => total + item.versoes.filter((versao) => versao.tipo !== "texto").length, 0) ?? 0;
  const ultimaConsulta = historico?.[0]?.consulta.consultadoEm;
  const clientesOrdenados = useMemo(
    () => [...(clientes ?? [])].sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR")),
    [clientes],
  );

  const resetFormulario = () => {
    setResultado("negativa");
    setMensagem("");
    setObservacoes("");
    setValidadeAte("");
    setArquivo(null);
  };

  const abrirPortal = async (consulta: ConsultaAtiva) => {
    try {
      await navigator.clipboard.writeText(consulta.cnpj);
      toast.success("CNPJ copiado. Cole no portal da Receita.");
    } catch {
      toast.info(`Copie o CNPJ: ${consulta.cnpj}`);
    }
    window.open(consulta.urlFonte, "_blank", "noopener,noreferrer");
  };

  const enviarParaExtensao = (consulta: ConsultaAtiva) => {
    const requestId = crypto.randomUUID();
    setAutomacaoAtiva({ ...consulta, requestId });
    setAutomacaoMensagem("Enviando a consulta para o Chrome do operador.");
    window.postMessage({
      source: PORTAL_MESSAGE_SOURCE,
      channel: EXTENSION_CHANNEL,
      type: "CND_START",
      payload: {
        requestId,
        consultaId: consulta.id,
        clienteId: consulta.clienteId,
        cnpj: consulta.cnpj,
        origem: consulta.origem,
      },
    }, window.location.origin);
  };

  const encerrarNaExtensao = (requestId: string) => {
    window.postMessage({
      source: PORTAL_MESSAGE_SOURCE,
      channel: EXTENSION_CHANNEL,
      type: "CND_STOP",
      requestId,
    }, window.location.origin);
  };

  const iniciarFluxo = async (origem: OrigemConsulta, empresa = clienteSelecionado) => {
    if (automacaoAtiva) {
      toast.info("Aguarde a consulta atual ou conclua o registro pendente.");
      return;
    }
    if (!empresa) {
      toast.error("Selecione uma empresa para consultar.");
      return;
    }
    try {
      const consulta = await iniciarMutation.mutateAsync({ clienteId: empresa.id, origem });
      const ativa: ConsultaAtiva = {
        id: consulta.id,
        clienteId: empresa.id,
        clienteNome: empresa.razaoSocial,
        cnpj: consulta.cnpj,
        origem,
        urlFonte: consulta.urlFonte,
      };
      resetFormulario();
      if (extensaoDisponivel) {
        enviarParaExtensao(ativa);
      } else {
        setConsultaAtiva(ativa);
        await abrirPortal(ativa);
      }
      await utils.certidoes.list.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a consulta.");
    }
  };

  const iniciarNovaEmissao = async () => {
    if (!consultaAtiva) return;
    const empresa = clientes?.find((item) => item.id === consultaAtiva.clienteId);
    if (!empresa) return;
    setFinalizando(true);
    try {
      await registrarMutation.mutateAsync({
        id: consultaAtiva.id,
        resultado: "sem_certidao_valida",
        mensagemCapturada: mensagem.trim() || "Nenhuma certidão válida foi localizada na consulta de documentos emitidos.",
        observacoes: observacoes.trim() || undefined,
      });
      setConsultaAtiva(null);
      await iniciarFluxo("nova_emissao_assistida", empresa);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a nova emissão.");
    } finally {
      setFinalizando(false);
    }
  };

  const finalizarConsulta = async () => {
    if (!consultaAtiva) return;
    if (!arquivo && !mensagem.trim()) {
      toast.error("Anexe o PDF/captura ou registre a mensagem apresentada pela Receita.");
      return;
    }
    if (arquivo && arquivo.size > 10 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 10 MB.");
      return;
    }

    setFinalizando(true);
    try {
      if (arquivo) {
        await anexarMutation.mutateAsync({
          consultaId: consultaAtiva.id,
          fileBase64: await arquivoParaBase64(arquivo),
          fileName: arquivo.name,
          mimeType: arquivo.type as "application/pdf" | "image/png" | "image/jpeg" | "image/webp",
          validadeAte: validadeAte || undefined,
        });
      }
      await registrarMutation.mutateAsync({
        id: consultaAtiva.id,
        resultado: resultado as Exclude<ResultadoCertidao, "nao_classificado">,
        mensagemCapturada: mensagem.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      });
      toast.success("Consulta registrada com operador, horário e versão captada.");
      if (automacaoAtiva?.id === consultaAtiva.id) {
        encerrarNaExtensao(automacaoAtiva.requestId);
        setAutomacaoAtiva(null);
        setAutomacaoMensagem("");
      }
      setConsultaAtiva(null);
      resetFormulario();
      await utils.certidoes.list.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a consulta.");
    } finally {
      setFinalizando(false);
    }
  };

  useEffect(() => {
    const ping = () => window.postMessage({
      source: PORTAL_MESSAGE_SOURCE,
      channel: EXTENSION_CHANNEL,
      type: "CND_PING",
    }, window.location.origin);

    const receberEvento = async (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source !== EXTENSION_MESSAGE_SOURCE || data.channel !== EXTENSION_CHANNEL) return;
      if (data.type === "EXTENSION_READY") {
        setExtensaoDisponivel(true);
        return;
      }

      const payload = data.payload ?? {};
      const job = payload.job;
      if (!job?.requestId || !job.consultaId) return;

      if (data.type === "CND_PROGRESS") {
        setAutomacaoMensagem(payload.message || "Consulta automática em andamento.");
        return;
      }
      if (data.type === "CND_NEEDS_HUMAN") {
        setAutomacaoMensagem(payload.message || "A Receita solicitou intervenção do operador.");
        if (job.origem === "nova_emissao_assistida") {
          const empresa = clientes?.find((item) => item.id === job.clienteId);
          if (empresa) {
            setConsultaAtiva({
              id: job.consultaId,
              clienteId: empresa.id,
              clienteNome: empresa.razaoSocial,
              cnpj: empresa.cnpj,
              origem: "nova_emissao_assistida",
              urlFonte: RECEITA_CERTIDOES_URL,
            });
          }
        }
        toast.warning(payload.message || "Conclua o hCaptcha na aba da Receita.");
        return;
      }

      const finalKey = `${data.type}:${job.requestId}`;
      if (eventosFinalizados.current.has(finalKey)) return;
      eventosFinalizados.current.add(finalKey);

      try {
        if (data.type === "CND_COMPLETE" && payload.pdfBase64) {
          await anexarMutation.mutateAsync({
            consultaId: job.consultaId,
            fileBase64: payload.pdfBase64,
            fileName: payload.fileName || `CND-Federal-${job.cnpj}.pdf`,
            mimeType: "application/pdf",
            validadeAte: payload.validadeAte || undefined,
          });
          await registrarMutation.mutateAsync({
            id: job.consultaId,
            resultado: payload.result === "positiva_efeito_negativa" ? "positiva_efeito_negativa" : "negativa",
            mensagemCapturada: payload.message || "Segunda via recuperada automaticamente pela extensão.",
            observacoes: "Operação automática no Chrome vinculado ao Portal Controller.",
          });
          setAutomacaoAtiva(null);
          setAutomacaoMensagem("");
          toast.success("Certidão recuperada e registrada automaticamente.");
        } else if (data.type === "CND_NEEDS_ISSUANCE") {
          await registrarMutation.mutateAsync({
            id: job.consultaId,
            resultado: "sem_certidao_valida",
            mensagemCapturada: payload.message || "Nenhuma certidão válida foi localizada.",
            observacoes: "Consulta anterior concluída automaticamente; nova emissão necessária.",
          });
          setAutomacaoAtiva(null);
          const empresa = clientes?.find((item) => item.id === job.clienteId);
          if (empresa) await iniciarFluxo("nova_emissao_assistida", empresa);
        } else if (data.type === "CND_UNAVAILABLE" || data.type === "CND_ERROR") {
          await registrarMutation.mutateAsync({
            id: job.consultaId,
            resultado: data.type === "CND_UNAVAILABLE" ? "indisponivel" : "erro",
            mensagemCapturada: payload.message || "A Receita não concluiu a consulta automática.",
            observacoes: "Falha registrada automaticamente pela extensão Chrome.",
          });
          setAutomacaoAtiva(null);
          setAutomacaoMensagem("");
          toast.error(payload.message || "A consulta automática não foi concluída.");
        }
        await utils.certidoes.list.invalidate();
      } catch (error) {
        eventosFinalizados.current.delete(finalKey);
        toast.error(error instanceof Error ? error.message : "Não foi possível registrar o retorno automático.");
      }
    };

    window.addEventListener("message", receberEvento);
    ping();
    const interval = window.setInterval(ping, 5000);
    return () => {
      window.removeEventListener("message", receberEvento);
      window.clearInterval(interval);
    };
  }, [anexarMutation, clientes, registrarMutation, iniciarMutation, utils.certidoes.list]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in-up">
      <section className="overflow-hidden rounded-[28px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-9 sm:py-10">
        <div className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <Badge className="border border-emerald-300/20 bg-emerald-300/10 text-emerald-200 hover:bg-emerald-300/10">Piloto operacional</Badge>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">CND Federal</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Primeiro consulte certidões já emitidas e ainda válidas. Se não houver documento recuperável, avance para a nova emissão assistida.
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-300">Automação no Chrome</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${extensaoDisponivel ? "bg-emerald-300/15 text-emerald-200" : "bg-amber-300/15 text-amber-200"}`}>
                {extensaoDisponivel ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {extensaoDisponivel ? "Conectada" : "Modo assistido"}
              </span>
            </div>
            <Label htmlFor="empresa-cnd" className="text-xs font-semibold uppercase tracking-wide text-slate-300">Empresa</Label>
            <select
              id="empresa-cnd"
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-slate-900 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400"
              disabled={carregandoClientes || !!automacaoAtiva}
            >
              <option value="">{carregandoClientes ? "Carregando empresas..." : "Selecione pelo nome ou CNPJ"}</option>
              {clientesOrdenados.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.razaoSocial} — {cliente.cnpj}</option>)}
            </select>
            <Button
              className="mt-3 w-full bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
              onClick={() => iniciarFluxo("consulta_anterior")}
              disabled={!clienteId || iniciarMutation.isPending || !!automacaoAtiva}
            >
              {iniciarMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : extensaoDisponivel ? <Bot className="mr-2 h-4 w-4" /> : <Search className="mr-2 h-4 w-4" />}
              {extensaoDisponivel ? "Consultar automaticamente" : "Consultar em modo assistido"}
            </Button>
            {automacaoAtiva && <p className="mt-3 text-xs leading-5 text-emerald-200">{automacaoMensagem || "Consulta automática em andamento."}</p>}
            {!extensaoDisponivel && (
              <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3">
                <p className="text-xs leading-5 text-amber-100">Instale a extensão uma única vez para preencher o CNPJ, consultar e registrar a segunda via automaticamente.</p>
                <Button asChild size="sm" variant="secondary" className="mt-2 h-8 w-full text-xs">
                  <a href={EXTENSION_DOWNLOAD_URL} download><Download className="mr-1.5 h-3.5 w-3.5" />Baixar extensão do Chrome</a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-2xl font-semibold">{consultasConcluidas}</p><p className="text-xs text-muted-foreground">consultas concluídas</p></div></CardContent></Card>
        <Card className="shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><FileCheck2 className="h-5 w-5" /></div><div><p className="text-2xl font-semibold">{documentosCaptados}</p><p className="text-xs text-muted-foreground">documentos captados</p></div></CardContent></Card>
        <Card className="shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><CalendarClock className="h-5 w-5" /></div><div><p className="text-sm font-semibold">{formatarDataHora(ultimaConsulta)}</p><p className="text-xs text-muted-foreground">última consulta registrada</p></div></CardContent></Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Histórico de consultas</CardTitle>
            <p className="text-sm text-muted-foreground">Cada tentativa preserva origem, operador, horário, resultado e versões captadas.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {carregandoHistorico ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando histórico</div>
            ) : !historico?.length ? (
              <div className="rounded-xl border border-dashed p-10 text-center"><FileClock className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-medium">Nenhuma consulta registrada</p><p className="mt-1 text-xs text-muted-foreground">Selecione uma empresa para iniciar o piloto.</p></div>
            ) : historico.map(({ consulta, cliente, versoes }) => (
              <div key={consulta.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{cliente.razaoSocial}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{cliente.cnpj} · {origemLabel(consulta.origem)}</p>
                  </div>
                  <Badge variant="outline" className="bg-background">{RESULTADO_CERTIDAO_LABELS[consulta.resultado]}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{formatarDataHora(consulta.consultadoEm)}</span>
                  <span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{consulta.operadorNome}</span>
                  <span className="flex items-center gap-1.5"><FileClock className="h-3.5 w-3.5" />{versoes.length} versão{versoes.length === 1 ? "" : "ões"}</span>
                </div>
                {(consulta.mensagemCapturada || consulta.observacoes) && <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">{consulta.mensagemCapturada || consulta.observacoes}</p>}
                {(versoes.some((versao) => versao.fileUrl) || ["iniciada", "aguardando_emissao", "aguardando_registro"].includes(consulta.status)) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["iniciada", "aguardando_emissao", "aguardando_registro"].includes(consulta.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          resetFormulario();
                          setConsultaAtiva({
                            id: consulta.id,
                            clienteId: cliente.id,
                            clienteNome: cliente.razaoSocial,
                            cnpj: cliente.cnpj,
                            origem: consulta.origem,
                            urlFonte: consulta.urlFonte,
                          });
                        }}
                      >
                        <FileClock className="mr-1.5 h-3.5 w-3.5" />Continuar registro
                      </Button>
                    )}
                    {versoes.filter((versao) => versao.fileUrl).map((versao) => (
                      <Button key={versao.id} variant="outline" size="sm" asChild className="h-8 text-xs">
                        <a href={versao.fileUrl!} target="_blank" rel="noreferrer"><Download className="mr-1.5 h-3.5 w-3.5" />Versão {versao.versao}</a>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="h-fit shadow-sm">
          <CardHeader><CardTitle className="text-base">Como funciona</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">1</span><p className="leading-6 text-muted-foreground">O sistema registra o operador e abre a consulta de certidões já emitidas.</p></div>
            <div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">2</span><p className="leading-6 text-muted-foreground">Com a extensão conectada, o CNPJ é preenchido e a consulta é iniciada automaticamente. A cópia manual fica apenas como contingência.</p></div>
            <div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">3</span><p className="leading-6 text-muted-foreground">Se não existir versão válida, o fluxo cria uma nova tentativa de emissão assistida.</p></div>
            <div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">4</span><p className="leading-6 text-muted-foreground">PDF, captura ou mensagem são preservados com data e operador.</p></div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!consultaAtiva} onOpenChange={(aberta) => !aberta && setConsultaAtiva(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar resultado da CND Federal</DialogTitle>
            <DialogDescription>{consultaAtiva?.clienteNome} · {consultaAtiva?.cnpj}</DialogDescription>
          </DialogHeader>

          {consultaAtiva && (
            <div className="space-y-5">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" /><div><p className="text-sm font-semibold">{origemLabel(consultaAtiva.origem)}</p><p className="mt-1 text-xs leading-5 text-blue-800">{consultaAtiva.origem === "consulta_anterior" ? "Use Consultar Certidão e procure uma segunda via ainda válida." : "Use Emitir Certidão. Se o hCaptcha solicitar um desafio, conclua-o manualmente no portal oficial."}</p></div></div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(consultaAtiva.cnpj).then(() => toast.success("CNPJ copiado"))}><Clipboard className="mr-1.5 h-3.5 w-3.5" />Copiar CNPJ</Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(RECEITA_CERTIDOES_URL, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir Receita</Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Resultado</Label><Select value={resultado} onValueChange={(value) => setResultado(value as ResultadoCertidao)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{resultadosDisponiveis.map((item) => <SelectItem key={item} value={item}>{RESULTADO_CERTIDAO_LABELS[item]}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="validade-cnd">Validade do documento</Label><Input id="validade-cnd" type="date" value={validadeAte} onChange={(event) => setValidadeAte(event.target.value)} /></div>
              </div>

              <div className="space-y-2"><Label htmlFor="evidencia-cnd">PDF ou captura da tela</Label><Input id="evidencia-cnd" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => setArquivo(event.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">PDF, PNG, JPG ou WebP, até 10 MB. O conteúdo é validado antes do armazenamento.</p></div>
              <div className="space-y-2"><Label htmlFor="mensagem-cnd">Mensagem apresentada pela Receita</Label><Textarea id="mensagem-cnd" value={mensagem} onChange={(event) => setMensagem(event.target.value)} placeholder="Cole aqui a mensagem quando não houver documento para baixar." rows={3} /></div>
              <div className="space-y-2"><Label htmlFor="observacoes-cnd">Observações internas</Label><Textarea id="observacoes-cnd" value={observacoes} onChange={(event) => setObservacoes(event.target.value)} placeholder="Informação complementar para auditoria." rows={2} /></div>

              {consultaAtiva.origem === "consulta_anterior" && (
                <Button variant="outline" className="w-full border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" onClick={iniciarNovaEmissao} disabled={finalizando}>
                  <AlertCircle className="mr-2 h-4 w-4" />Não há certidão válida — iniciar nova emissão
                </Button>
              )}
            </div>
          )}

          <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-background/95 p-4 backdrop-blur sm:-mx-6">
            <Button variant="outline" onClick={() => setConsultaAtiva(null)} disabled={finalizando}>Cancelar</Button>
            <Button onClick={finalizarConsulta} disabled={finalizando || consultaAtiva?.id === 0}>{finalizando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}Registrar versão captada</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
