import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  FileText,
  Filter,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
  Users,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePermissoes } from "@/hooks/usePermissoes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export type PendenciasView = "dashboard" | "lista" | "importar" | "excecoes";

type Status =
  | "sem_contato"
  | "cliente_contatado"
  | "contato_sem_retorno"
  | "fase_ajustes"
  | "aprovacao_minuta"
  | "links_enviados"
  | "assinado_parcial"
  | "assinado_total";

type Tipo = "prestacao_servico" | "coworking";

const STATUS: Record<Status, { label: string; className: string }> = {
  sem_contato: { label: "Sem contato", className: "border-slate-200 bg-slate-100 text-slate-700" },
  cliente_contatado: { label: "Cliente contatado", className: "border-blue-200 bg-blue-50 text-blue-700" },
  contato_sem_retorno: { label: "Contato sem retorno", className: "border-amber-200 bg-amber-50 text-amber-800" },
  fase_ajustes: { label: "Fase de ajustes", className: "border-orange-200 bg-orange-50 text-orange-800" },
  aprovacao_minuta: { label: "Aprovação de minuta", className: "border-violet-200 bg-violet-50 text-violet-800" },
  links_enviados: { label: "Links enviados", className: "border-cyan-200 bg-cyan-50 text-cyan-800" },
  assinado_parcial: { label: "Assinado parcial", className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800" },
  assinado_total: { label: "Assinado total", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
};

const TIPOS: Record<Tipo, string> = {
  prestacao_servico: "Prestação de serviço",
  coworking: "Coworking",
};

const STATUS_LIST = Object.keys(STATUS) as Status[];
const TIPO_LIST = Object.keys(TIPOS) as Tipo[];

function formatarCnpj(cnpj: string) {
  const digits = cnpj.replace(/\D/g, "");
  return digits.length === 14 ? digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : cnpj;
}

function dataHora(valor?: string | Date | null) {
  return valor ? new Date(valor).toLocaleString("pt-BR") : "—";
}

function BadgeStatus({ status }: { status: string }) {
  const config = STATUS[status as Status] ?? { label: status, className: "border-slate-200 bg-slate-100 text-slate-700" };
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
}

function SeletorStatus({ value, onChange, id }: { value: Status; onChange: (value: Status) => void; id?: string }) {
  return (
    <Select value={value} onValueChange={(novo) => onChange(novo as Status)}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>{STATUS_LIST.map((status) => <SelectItem key={status} value={status}>{STATUS[status].label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function SeletorTipo({ value, onChange, id }: { value: Tipo; onChange: (value: Tipo) => void; id?: string }) {
  return (
    <Select value={value} onValueChange={(novo) => onChange(novo as Tipo)}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>{TIPO_LIST.map((tipo) => <SelectItem key={tipo} value={tipo}>{TIPOS[tipo]}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export default function PendenciasContrato({ view }: { view: PendenciasView }) {
  if (view === "importar") return <ImportarPendencias />;
  if (view === "excecoes") return <ExcecoesPendencias />;
  if (view === "lista") return <ListaPendencias />;
  return <PainelPendencias />;
}

function PainelPendencias() {
  const [, navegar] = useLocation();
  const { pode } = usePermissoes();
  const { data: resumo, isLoading, refetch } = trpc.pendenciasContrato.resumo.useQuery();
  const cards = [
    { titulo: "Pendências abertas", valor: resumo?.abertas ?? 0, descricao: "Ainda não concluídas", icon: FileText, color: "text-violet-700", bg: "bg-violet-50", status: undefined },
    { titulo: "Sem contato", valor: resumo?.porStatus?.sem_contato ?? 0, descricao: "Aguardam primeira abordagem", icon: Users, color: "text-slate-700", bg: "bg-slate-100", status: "sem_contato" },
    { titulo: "Retorno vencido", valor: resumo?.vencendo48h ?? 0, descricao: "48h já expiradas", icon: Clock3, color: "text-amber-700", bg: "bg-amber-50", status: "cliente_contatado" },
    { titulo: "Links enviados", valor: resumo?.porStatus?.links_enviados ?? 0, descricao: "Acompanhar assinaturas", icon: Link2, color: "text-cyan-700", bg: "bg-cyan-50", status: "links_enviados" },
    { titulo: "Assinatura parcial", valor: resumo?.porStatus?.assinado_parcial ?? 0, descricao: "Requer validação final", icon: ShieldAlert, color: "text-fuchsia-700", bg: "bg-fuchsia-50", status: "assinado_parcial" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Contratos e assinaturas</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Gestor de Pendências</h1>
          <p className="mt-1 text-sm text-muted-foreground">Controle as abordagens, documentos e assinaturas usando a base central de clientes.</p>
        </div>
        <div className="flex gap-2">
          {pode("pendencias_contrato", "importar") && <Button onClick={() => navegar("/pendencias-contrato/importar")} className="gap-2"><Upload className="h-4 w-4" /> Importar planilha</Button>}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2"><RefreshCw className="h-4 w-4" /> Atualizar</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return <button key={card.titulo} type="button" onClick={() => navegar(`/pendencias-contrato/lista${card.status ? `?status=${card.status}` : ""}`)} className="rounded-xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-2"><span className={`rounded-lg p-2 ${card.bg} ${card.color}`}><Icon className="h-4 w-4" /></span></div>
            <p className={`mt-4 text-3xl font-semibold ${card.color}`}>{isLoading ? "—" : card.valor}</p>
            <p className="mt-1 text-sm font-medium">{card.titulo}</p><p className="mt-0.5 text-xs text-muted-foreground">{card.descricao}</p>
          </button>;
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por etapa</CardTitle><CardDescription>Clique em uma etapa para abrir a lista filtrada.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {STATUS_LIST.map((status) => {
              const total = resumo?.porStatus?.[status] ?? 0;
              const percentual = resumo?.total ? Math.round((total / resumo.total) * 100) : 0;
              return <button key={status} type="button" onClick={() => navegar(`/pendencias-contrato/lista?status=${status}`)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/70"><div className="w-40 shrink-0"><BadgeStatus status={status} /></div><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${percentual}%` }} /></div><span className="w-9 text-right text-sm font-semibold">{total}</span></button>;
            })}
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-amber-900"><AlertCircle className="h-4 w-4" /> Exceções de importação</CardTitle><CardDescription>Registros sem vínculo automático permanecem disponíveis para decisão manual.</CardDescription></CardHeader>
          <CardContent><p className="text-4xl font-semibold text-amber-800">{isLoading ? "—" : resumo?.excecoesPendentes ?? 0}</p><p className="mt-1 text-sm text-amber-900/80">pendência(s) aguardando vínculo ou exclusão.</p>{pode("pendencias_contrato", "gerenciar_excecoes") && <Button variant="outline" className="mt-5 border-amber-300 bg-white text-amber-900" onClick={() => navegar("/pendencias-contrato/excecoes")}>Tratar exceções <ArrowRight className="ml-2 h-4 w-4" /></Button>}</CardContent>
        </Card>
      </div>
    </div>
  );
}

function ListaPendencias() {
  const [, navegar] = useLocation();
  const [status, setStatus] = useState<string>(() => new URLSearchParams(window.location.search).get("status") ?? "all");
  const [tipo, setTipo] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const { data: pendencias = [], isLoading, refetch } = trpc.pendenciasContrato.list.useQuery({
    status: status === "all" ? undefined : status as Status,
    tipo: tipo === "all" ? undefined : tipo as Tipo,
    search: busca || undefined,
  });

  return <div className="mx-auto max-w-7xl space-y-6 pb-10">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-semibold tracking-tight">Pendências contratuais</h1><p className="mt-1 text-sm text-muted-foreground">Atualizações de status exigem justificativa e ficam registradas na linha do tempo.</p></div><Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /> Atualizar</Button></div>
    <Card><CardContent className="grid gap-3 p-4 md:grid-cols-[1.3fr_0.8fr_0.8fr_auto]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar razão social ou CNPJ..." value={busca} onChange={(e) => setBusca(e.target.value)} /></div><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{STATUS_LIST.map((item) => <SelectItem key={item} value={item}>{STATUS[item].label}</SelectItem>)}</SelectContent></Select><Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue placeholder="Todos os tipos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{TIPO_LIST.map((item) => <SelectItem key={item} value={item}>{TIPOS[item]}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="sm" onClick={() => { setBusca(""); setStatus("all"); setTipo("all"); }}><X className="mr-1 h-4 w-4" /> Limpar</Button></CardContent></Card>
    <Card><CardContent className="p-0"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">Fila operacional</h2><p className="text-xs text-muted-foreground">Prioridade para contatos com prazo de retorno mais próximo.</p></div><span className="text-sm text-muted-foreground">{pendencias.length} registro(s)</span></div>{isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div> : !pendencias.length ? <EmptyState /> : <div className="divide-y">{pendencias.map((item: any) => <button key={item.pendencia.id} type="button" onClick={() => navegar(`/pendencias-contrato/${item.pendencia.id}`)} className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-violet-50/60 md:grid-cols-[minmax(240px,1.4fr)_180px_180px_150px]"><div><p className="font-semibold leading-tight">{item.cliente.razaoSocial}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{formatarCnpj(item.cliente.cnpj)}</p></div><div><Badge variant="secondary">{TIPOS[item.pendencia.tipo as Tipo]}</Badge><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.pendencia.descricaoOrigem ?? "Sem descrição de origem"}</p></div><div><BadgeStatus status={item.pendencia.status} /><p className="mt-1 text-xs text-muted-foreground">Atualizado {dataHora(item.pendencia.updatedAt)}</p></div><div className="text-sm">{item.pendencia.retornoAte ? <><p className="font-medium text-amber-800">Retorno até</p><p className="text-xs text-muted-foreground">{dataHora(item.pendencia.retornoAte)}</p></> : <span className="text-muted-foreground">Sem prazo ativo</span>}</div></button>)}</div>}</CardContent></Card>
  </div>;
}

function ImportarPendencias() {
  const { pode } = usePermissoes();
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<any>(null);
  const ler = trpc.pendenciasContrato.previsualizarImportacao.useMutation({ onSuccess: (resultado) => { setPrevia(resultado); toast.success("Prévia gerada. Revise antes de confirmar."); }, onError: (erro) => toast.error(erro.message) });
  const confirmar = trpc.pendenciasContrato.confirmarImportacao.useMutation({ onSuccess: (resultado) => { toast.success(`${resultado.criadas} pendência(s) criada(s) e ${resultado.excecoesRegistradas} exceção(ões) registrada(s).`); setPrevia(null); setArquivo(null); void utils.pendenciasContrato.invalidate(); }, onError: (erro) => toast.error(erro.message) });

  const selecionarArquivo = async (file?: File) => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { toast.error("Envie uma planilha XLSX, XLS ou CSV."); return; }
    setArquivo(file); setPrevia(null);
    const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    ler.mutate({ fileBase64: base64, fileName: file.name });
  };
  const alterarRegistro = (indice: number, campo: "tipo" | "status" | "incluir", valor: any) => setPrevia((atual: any) => ({ ...atual, registros: atual.registros.map((registro: any, index: number) => index === indice ? { ...registro, [campo]: valor } : registro) }));

  if (!pode("pendencias_contrato", "importar")) return <AcessoNegado />;
  return <div className="mx-auto max-w-7xl space-y-6 pb-10"><div><h1 className="text-3xl font-semibold tracking-tight">Importar pendências</h1><p className="mt-1 text-sm text-muted-foreground">A conciliação usa CNPJ e não cria clientes automaticamente. O andamento interno é preservado em reimportações.</p></div>
    <Card className="border-dashed"><CardContent className="flex flex-col items-center p-9 text-center"><span className="rounded-2xl bg-violet-50 p-4 text-violet-700"><FileSpreadsheet className="h-8 w-8" /></span><h2 className="mt-4 font-semibold">Planilha de pendências contratuais</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">Colunas esperadas: Nome, Cliente, CNPJ/CPF e STATUS. “ASSINADO” será tratado como “Assinado parcial”.</p><input ref={inputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => selecionarArquivo(e.target.files?.[0])} /><Button className="mt-5 gap-2" onClick={() => inputRef.current?.click()} disabled={ler.isPending}><Upload className="h-4 w-4" /> {ler.isPending ? "Lendo planilha..." : arquivo ? "Escolher outra planilha" : "Selecionar planilha"}</Button>{arquivo && <p className="mt-3 text-xs text-muted-foreground">{arquivo.name}</p>}</CardContent></Card>
    {previa && <><div className="grid gap-3 sm:grid-cols-3"><Metric title="Registros conciliados" value={previa.registros.length} className="text-emerald-700" /><Metric title="Exceções preservadas" value={previa.excecoes.length} className="text-amber-700" /><Metric title="Aba de origem" value={previa.aba} className="text-violet-700" /></div><Card><CardHeader><CardTitle className="text-base">Registros que serão importados</CardTitle><CardDescription>Você pode ajustar tipo, status e inclusão antes da confirmação.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-2">Incluir</th><th className="p-2">Cliente</th><th className="p-2">CNPJ</th><th className="p-2">Tipo</th><th className="p-2">Status inicial</th></tr></thead><tbody>{previa.registros.map((registro: any, indice: number) => <tr key={`${registro.linhaOrigem}-${registro.documento}`} className="border-b last:border-0"><td className="p-2"><input aria-label={`Incluir ${registro.nomeClienteOrigem}`} type="checkbox" checked={registro.incluir} onChange={(e) => alterarRegistro(indice, "incluir", e.target.checked)} /></td><td className="p-2"><p className="font-medium">{registro.nomeClienteOrigem}</p><p className="max-w-xs truncate text-xs text-muted-foreground">{registro.descricaoOrigem}</p></td><td className="p-2 font-mono text-xs">{formatarCnpj(registro.documento)}</td><td className="p-2"><SeletorTipo value={registro.tipo} onChange={(valor) => alterarRegistro(indice, "tipo", valor)} /></td><td className="p-2"><SeletorStatus value={registro.status} onChange={(valor) => alterarRegistro(indice, "status", valor)} /></td></tr>)}</tbody></table></CardContent></Card>{previa.excecoes.length > 0 && <Card className="border-amber-200"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-amber-900"><AlertCircle className="h-4 w-4" /> Exceções que serão preservadas</CardTitle><CardDescription>Não serão criados clientes; estes itens aparecerão na fila de tratamento manual.</CardDescription></CardHeader><CardContent className="space-y-2">{previa.excecoes.map((item: any) => <div key={`${item.linhaOrigem}-${item.documento}`} className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-sm"><p className="font-medium">{item.nomeClienteOrigem} <span className="font-mono text-xs">{formatarCnpj(item.documento)}</span></p><p className="mt-1 text-xs text-amber-900/80">{item.motivo}</p></div>)}</CardContent></Card>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setPrevia(null); setArquivo(null); }}>Cancelar</Button><Button onClick={() => confirmar.mutate({ arquivoOrigem: previa.arquivoOrigem, registros: previa.registros, excecoes: previa.excecoes })} disabled={confirmar.isPending} className="gap-2">{confirmar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar importação</Button></div></>}
  </div>;
}

function ExcecoesPendencias() {
  const { pode } = usePermissoes();
  const utils = trpc.useUtils();
  const [aberta, setAberta] = useState<any>(null);
  const [busca, setBusca] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null);
  const [tipo, setTipo] = useState<Tipo>("prestacao_servico");
  const [status, setStatus] = useState<Status>("sem_contato");
  const [justificativa, setJustificativa] = useState("");
  const { data: excecoes = [], isLoading } = trpc.pendenciasContrato.listExcecoes.useQuery({ situacao: "pendente" });
  const { data: clientes = [] } = trpc.pendenciasContrato.buscarClientesParaVinculo.useQuery({ search: busca }, { enabled: busca.trim().length >= 2 && !!aberta });
  const resolver = trpc.pendenciasContrato.resolverExcecao.useMutation({ onSuccess: () => { toast.success("Exceção tratada e registrada."); setAberta(null); setBusca(""); setClienteSelecionado(null); setJustificativa(""); void utils.pendenciasContrato.invalidate(); }, onError: (erro) => toast.error(erro.message) });
  const abrir = (item: any) => { setAberta(item); setTipo(item.tipoSugerido as Tipo); setStatus(item.statusSugerido as Status); setBusca(""); setClienteSelecionado(null); setJustificativa(""); };
  if (!pode("pendencias_contrato", "gerenciar_excecoes")) return <AcessoNegado />;
  return <div className="mx-auto max-w-6xl space-y-6 pb-10"><div><h1 className="text-3xl font-semibold tracking-tight">Exceções de importação</h1><p className="mt-1 text-sm text-muted-foreground">Vincule um CNPJ ao cliente correto ou descarte a pendência mantendo a decisão auditável.</p></div><Card><CardContent className="p-0"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">Aguardando decisão</h2><p className="text-xs text-muted-foreground">Nenhum cliente é criado automaticamente a partir desta fila.</p></div><Badge variant="secondary">{excecoes.length}</Badge></div>{isLoading ? <div className="p-6"><Skeleton className="h-16 w-full" /></div> : !excecoes.length ? <div className="py-14 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-3 font-medium">Não há exceções pendentes</p></div> : <div className="divide-y">{excecoes.map((item: any) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="font-semibold">{item.nomeClienteOrigem}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{formatarCnpj(item.documento)} · Linha {item.linhaOrigem}</p><p className="mt-2 text-sm text-amber-800">{item.motivo}</p></div><Button variant="outline" onClick={() => abrir(item)}>Tratar exceção</Button></div>)}</div>}</CardContent></Card>{aberta && <Card className="border-violet-200"><CardHeader><CardTitle className="text-base">Tratar: {aberta.nomeClienteOrigem}</CardTitle><CardDescription>{formatarCnpj(aberta.documento)} · escolha entre vincular a um cliente existente ou excluir a linha de origem.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="space-y-2 md:col-span-2"><Label>Buscar cliente existente</Label><Input placeholder="Razão social ou CNPJ" value={busca} onChange={(e) => { setBusca(e.target.value); setClienteSelecionado(null); }} />{busca.trim().length >= 2 && !clienteSelecionado && <div className="max-h-44 overflow-y-auto rounded-lg border bg-white">{clientes.map((cliente: any) => <button key={cliente.id} type="button" onClick={() => { setClienteSelecionado(cliente); setBusca(`${cliente.razaoSocial} · ${formatarCnpj(cliente.cnpj)}`); }} className="block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-violet-50">{cliente.razaoSocial}<span className="ml-2 font-mono text-xs text-muted-foreground">{formatarCnpj(cliente.cnpj)}</span></button>)}{!clientes.length && <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}</div>}{clienteSelecionado && <p className="text-xs font-medium text-emerald-700">Cliente selecionado: {clienteSelecionado.razaoSocial}</p>}</div><div className="space-y-2"><Label>Tipo de contrato</Label><SeletorTipo value={tipo} onChange={setTipo} /></div><div className="space-y-2"><Label>Status inicial</Label><SeletorStatus value={status} onChange={setStatus} /></div><div className="space-y-2 md:col-span-2"><Label>Justificativa da decisão</Label><Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Explique o vínculo ou o motivo da exclusão..." /></div><div className="flex flex-wrap justify-end gap-2 md:col-span-2"><Button variant="outline" onClick={() => setAberta(null)}>Cancelar</Button><Button variant="destructive" disabled={resolver.isPending || justificativa.trim().length < 3} onClick={() => resolver.mutate({ id: aberta.id, acao: "excluir", justificativa })}>Excluir da fila</Button><Button disabled={resolver.isPending || !clienteSelecionado || justificativa.trim().length < 3} onClick={() => resolver.mutate({ id: aberta.id, acao: "vincular", clienteId: clienteSelecionado?.id, tipo, status, justificativa })}>Vincular ao cliente</Button></div></CardContent></Card>}</div>;
}

function Metric({ title, value, className }: { title: string; value: string | number; className: string }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{title}</p><p className={`mt-1 text-2xl font-semibold ${className}`}>{value}</p></CardContent></Card>; }
function EmptyState() { return <div className="py-14 text-center"><Filter className="mx-auto h-8 w-8 text-violet-600" /><p className="mt-3 font-medium">Nenhuma pendência encontrada</p><p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou importe a planilha de pendências.</p></div>; }
function AcessoNegado() { return <div className="mx-auto max-w-xl py-16 text-center"><ShieldAlert className="mx-auto h-10 w-10 text-amber-600" /><h1 className="mt-4 text-xl font-semibold">Ação não permitida</h1><p className="mt-2 text-sm text-muted-foreground">Seu perfil não possui permissão para esta área.</p></div>; }
