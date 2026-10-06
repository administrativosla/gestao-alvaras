import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownRight, ArrowUpRight, Archive, ClipboardList, FileDown, History, Inbox, Plus, Send, Tags, Users, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import DecGraficosDestinacao from "@/components/DecGraficosDestinacao";
import DecLancamentoDialog from "@/components/DecLancamentoDialog";
import { dataExibida, dataLocal, diaLocal, periodoAnterior } from "@/lib/decFormat";
import { linkRelatorioDec } from "@/lib/decRelatorio";
import { ROTA_HISTORICO_DEC } from "@shared/portal";

export default function DecDashboard() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [inicio, setInicio] = useState(() => diaLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [fim, setFim] = useState(() => diaLocal());
  const [categoriaFiltro, setCategoriaFiltro] = useState("all");
  const [operadorFiltro, setOperadorFiltro] = useState("all");
  const [clienteFiltro, setClienteFiltro] = useState<number | null>(null);
  const [buscaClienteFiltro, setBuscaClienteFiltro] = useState("");
  const [lancamentoOpen, setLancamentoOpen] = useState(false);
  const { data: categorias = [], error: erroCategorias } = trpc.dec.categorias.useQuery();
  const periodoValido = inicio <= fim;
  const filtroBase = { categoriaId: categoriaFiltro === "all" ? undefined : Number(categoriaFiltro), clienteId: clienteFiltro ?? undefined };
  const { data: todos = [], isLoading, error } = trpc.dec.listar.useQuery({ inicio, fim, ...filtroBase }, { enabled: periodoValido });
  const passado = useMemo(() => periodoAnterior(inicio, fim), [inicio, fim]);
  const { data: anteriores = [] } = trpc.dec.listar.useQuery({ ...passado, ...filtroBase }, { enabled: periodoValido });
  const { data: clientesFiltro = [] } = trpc.dec.clientes.useQuery({ pesquisa: buscaClienteFiltro }, { enabled: buscaClienteFiltro.trim().length >= 2 && !clienteFiltro });
  const operadores = Array.from(new Map(todos.map(l => [l.operadorId, l.operadorNome])).entries());
  const registros = todos.filter(l => operadorFiltro === "all" || l.operadorId === Number(operadorFiltro));
  const anterioresFiltrados = anteriores.filter(l => operadorFiltro === "all" || l.operadorId === Number(operadorFiltro));
  const somar = (lista: typeof registros, chave: "quantidade" | "redirecionadas" | "varias" | "internas" | "semAcao" | "inativos" | "pendentes") => lista.reduce((total, linha) => total + linha[chave], 0);
  const total = somar(registros, "quantidade");
  const pendentes = somar(registros, "pendentes");
  const totalAnterior = somar(anterioresFiltrados, "quantidade");
  const diferenca = totalAnterior ? Math.round((total - totalAnterior) / totalAnterior * 100) : null;
  const porCategoria = Array.from(new Map(registros.map(l => [l.categoriaId, l.categoria])).entries())
    .map(([id, nome]) => ({ id, nome, total: registros.filter(l => l.categoriaId === id).reduce((n, l) => n + l.quantidade, 0) }))
    .sort((a, b) => b.total - a.total);
  const porDia = Array.from(new Set(registros.map(l => dataExibida(l.dataRecebimento))))
    .map(data => ({ data, total: registros.filter(l => dataExibida(l.dataRecebimento) === data).reduce((n, l) => n + l.quantidade, 0) }));
  const maxDia = Math.max(1, ...porDia.map(d => d.total));
  const historicoParams = new URLSearchParams({ inicio, fim });
  if (categoriaFiltro !== "all") historicoParams.set("categoriaId", categoriaFiltro);
  if (operadorFiltro !== "all") historicoParams.set("operadorId", operadorFiltro);
  const rotaHistorico = `${ROTA_HISTORICO_DEC}?${historicoParams.toString()}`;

  return <div className="mx-auto max-w-7xl space-y-7 pb-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[.16em] text-teal-700"><Inbox className="h-3.5 w-3.5" /> Operação DEC</div><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Mensagens recebidas</h1><p className="mt-2 text-sm text-muted-foreground">Acompanhe recebimentos, classificações e pendências por categoria.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate(rotaHistorico)} className="gap-2"><History className="h-4 w-4" /> Histórico</Button><Button variant="outline" onClick={() => navigate("/dec/categorias")} className="gap-2"><Tags className="h-4 w-4" /> Categorias</Button><Button variant="outline" disabled={!periodoValido || isLoading || !!error || !!erroCategorias} onClick={() => window.open(linkRelatorioDec({ inicio, fim, categoriaId: filtroBase.categoriaId, operadorId: operadorFiltro === "all" ? undefined : Number(operadorFiltro), clienteId: clienteFiltro ?? undefined }), "_blank", "noopener,noreferrer")} className="gap-2"><FileDown className="h-4 w-4" /> Exportar PDF</Button><Button onClick={() => setLancamentoOpen(true)} className="gap-2 bg-teal-700 text-white hover:bg-teal-800"><Plus className="h-4 w-4" /> Lançar recebimentos</Button></div>
    </div>
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div><Label htmlFor="dec-inicio" className="text-xs">De</Label><Input id="dec-inicio" type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></div>
      <div><Label htmlFor="dec-fim" className="text-xs">Até</Label><Input id="dec-fim" type="date" value={fim} onChange={e => setFim(e.target.value)} /></div>
      <div><Label className="text-xs">Categoria</Label><Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="text-xs">Operador do lançamento</Label><Select value={operadorFiltro} onValueChange={setOperadorFiltro}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os operadores</SelectItem>{operadores.map(([id, nome]) => <SelectItem value={String(id)} key={id}>{nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="sm:col-span-2 lg:col-span-4"><Label htmlFor="dec-filtro-cliente" className="text-xs">Cliente vinculado (opcional)</Label><div className="flex gap-2"><Input id="dec-filtro-cliente" value={buscaClienteFiltro} onChange={e => { setBuscaClienteFiltro(e.target.value); setClienteFiltro(null); }} placeholder="Buscar razão social ou CNPJ; inclui inativos" />{clienteFiltro && <Button variant="ghost" onClick={() => { setClienteFiltro(null); setBuscaClienteFiltro(""); }}>Limpar</Button>}</div>{buscaClienteFiltro.trim().length >= 2 && !clienteFiltro && <div className="mt-1 max-h-36 overflow-y-auto rounded-md border bg-white">{clientesFiltro.map(c => <button key={c.id} type="button" onClick={() => { setClienteFiltro(c.id); setBuscaClienteFiltro(`${c.razaoSocial} · ${c.cnpj}`); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50">{c.razaoSocial} · {c.cnpj} {!c.ativo && "(inativo)"}</button>)}</div>}</div>
    </CardContent></Card>
    {!periodoValido && <p className="text-sm text-destructive">A data inicial deve ser anterior à data final.</p>}
    {(error || erroCategorias) && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar os dados: {(error || erroCategorias)?.message}</p>}
    {clienteFiltro && <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">Filtro de cliente: os totais abaixo incluem <strong>somente mensagens vinculadas a esse cliente</strong>, não envios para Várias, encaminhamentos internos nem todos os recebimentos dos mesmos lotes.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {([
        { label: clienteFiltro ? "Vinculadas ao cliente" : "Recebidas no período", value: total, icon: Inbox, tone: "text-teal-700 bg-teal-50" },
        { label: "Enviadas a clientes", value: somar(registros, "redirecionadas"), detalhe: !clienteFiltro ? `${somar(registros, "varias")} em Várias (já incluídas)` : undefined, icon: Send, tone: "text-blue-700 bg-blue-50" },
        { label: "Time interno", value: somar(registros, "internas"), icon: UsersRound, tone: "text-indigo-700 bg-indigo-50" },
        { label: "Arquivadas sem ação", value: somar(registros, "semAcao"), icon: Archive, tone: "text-slate-700 bg-slate-100" },
        { label: "Clientes inativos", value: somar(registros, "inativos"), icon: Users, tone: "text-amber-700 bg-amber-50" },
        { label: "A classificar", value: pendentes, icon: ClipboardList, tone: "text-orange-700 bg-orange-50" },
      ]).map(item => <Card key={item.label}><CardContent className="p-5"><div className={`mb-4 inline-flex rounded-lg p-2 ${item.tone}`}><item.icon className="h-5 w-5" /></div><p className="text-sm text-muted-foreground">{item.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums text-slate-950">{item.value.toLocaleString("pt-BR")}</p>{"detalhe" in item && item.detalhe && <p className="mt-1 text-xs text-blue-700">{item.detalhe}</p>}</CardContent></Card>)}
    </div>
    {pendentes > 0 && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900"><span><strong>{pendentes} mensagem(ns)</strong> ainda aguardam classificação no período.</span><Button size="sm" variant="outline" className="bg-white" onClick={() => navigate(rotaHistorico)}>Classificar no histórico</Button></div>}
    {periodoValido && !error && <DecGraficosDestinacao registros={registros} carregando={isLoading} clienteFiltrado={!!clienteFiltro} />}
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Volume por categoria</h2><Badge variant="outline">{porCategoria.length} categorias</Badge></div>{porCategoria.length ? <div className="space-y-4">{porCategoria.map(c => <div key={c.id}><div className="mb-1 flex justify-between text-sm"><span>{c.nome}</span><strong className="tabular-nums">{c.total}</strong></div><div className="h-2.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.max(2, c.total / Math.max(total, 1) * 100)}%` }} /></div></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhum recebimento neste período.</p>}</CardContent></Card>
      <Card><CardContent className="p-5"><h2 className="font-semibold">Comparativo do período</h2><p className="mt-5 text-xs text-muted-foreground">Período anterior ({dataLocal(passado.inicio).toLocaleDateString("pt-BR")} a {dataLocal(passado.fim).toLocaleDateString("pt-BR")})</p><p className="mt-1 text-3xl font-semibold tabular-nums">{totalAnterior}</p><p className="mt-3 flex items-center gap-1 text-sm">{diferenca === null ? "Sem base anterior para variação percentual" : <>{diferenca >= 0 ? <ArrowUpRight className="h-4 w-4 text-teal-700" /> : <ArrowDownRight className="h-4 w-4 text-orange-700" />}<strong>{diferenca > 0 ? "+" : ""}{diferenca}%</strong> em mensagens recebidas</>}</p></CardContent></Card>
    </div>
    {porDia.length > 0 && <Card><CardContent className="p-5"><h2 className="mb-5 font-semibold">Evolução diária</h2><div className="flex min-h-36 items-end gap-2 overflow-x-auto pb-2">{porDia.map(item => <div key={item.data} className="flex min-w-12 flex-1 flex-col items-center gap-2" title={`${item.data}: ${item.total} mensagens`}><span className="text-xs font-semibold tabular-nums">{item.total}</span><div className="w-full rounded-t-md bg-teal-600/85" style={{ height: `${Math.max(12, item.total / maxDia * 100)}px` }} /><span className="whitespace-nowrap text-[10px] text-muted-foreground">{item.data.slice(0, 5)}</span></div>)}</div></CardContent></Card>}
    {lancamentoOpen && <DecLancamentoDialog open={lancamentoOpen} onOpenChange={setLancamentoOpen} categorias={categorias} onSaved={(_id, classificadas, restantes, dia) => {
      setInicio(atual => dia < atual ? dia : atual);
      setFim(atual => dia > atual ? dia : atual);
      setCategoriaFiltro("all"); setOperadorFiltro("all"); setClienteFiltro(null); setBuscaClienteFiltro("");
      void utils.dec.listar.invalidate();
      toast.success(`Recebimento registrado: ${classificadas} classificadas e ${restantes} a classificar. Consulte os detalhes no Histórico.`);
    }} />}
  </div>;
}
