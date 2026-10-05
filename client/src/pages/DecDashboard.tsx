import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownRight, ArrowUpRight, Archive, ClipboardList, Download, History, Inbox, Plus, Send, Tags, Users } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import DecGraficosDestinacao from "@/components/DecGraficosDestinacao";

type Tipo = "redirecionada_ativo" | "arquivada_sem_acao" | "arquivada_inativo";
const tipos: Record<Tipo, string> = { redirecionada_ativo: "Redirecionada a cliente ativo", arquivada_sem_acao: "Arquivada sem encaminhamento", arquivada_inativo: "Arquivada — cliente inativo" };
function diaLocal(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dataLocal(d: string) { const [ano, mes, dia] = d.split("-").map(Number); return new Date(ano, mes - 1, dia); }
function periodoAnterior(inicio: string, fim: string) {
  const primeiro = dataLocal(inicio); const ultimo = dataLocal(fim);
  const dias = Math.round((ultimo.getTime() - primeiro.getTime()) / 86400000) + 1;
  const anteriorFim = new Date(primeiro); anteriorFim.setDate(anteriorFim.getDate() - 1);
  const anteriorInicio = new Date(anteriorFim); anteriorInicio.setDate(anteriorInicio.getDate() - dias + 1);
  return { inicio: diaLocal(anteriorInicio), fim: diaLocal(anteriorFim) };
}
function dataExibida(d: Date | string) { return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }); }
function chaveDia(d: Date | string) { return new Date(d).toISOString().slice(0, 10); }
function csvSeguro(valor: unknown) { const text = String(valor ?? ""); return `"${(/^[=+@-]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`; }

export default function DecDashboard() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [inicio, setInicio] = useState(() => diaLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [fim, setFim] = useState(() => diaLocal());
  const [categoriaFiltro, setCategoriaFiltro] = useState("all");
  const [operadorFiltro, setOperadorFiltro] = useState("all");
  const [clienteFiltro, setClienteFiltro] = useState<number | null>(null);
  const [buscaClienteFiltro, setBuscaClienteFiltro] = useState("");
  const [recebimentoOpen, setRecebimentoOpen] = useState(false);
  const [corrigirId, setCorrigirId] = useState<number | null>(null);
  const [categoriaId, setCategoriaId] = useState("");
  const [dia, setDia] = useState(() => diaLocal());
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [destinoOpen, setDestinoOpen] = useState(false);
  const [recebimentoId, setRecebimentoId] = useState<number | null>(null);
  const [destinoId, setDestinoId] = useState<number | undefined>();
  const [tipo, setTipo] = useState<Tipo>("redirecionada_ativo");
  const [quantidadeDestino, setQuantidadeDestino] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [destinoCliente, setDestinoCliente] = useState<number | null>(null);
  const [destinoObs, setDestinoObs] = useState("");
  const [historicoId, setHistoricoId] = useState<number | null>(null);
  const { data: categorias = [], error: erroCategorias } = trpc.dec.categorias.useQuery();
  const filtroBase = { categoriaId: categoriaFiltro === "all" ? undefined : Number(categoriaFiltro), clienteId: clienteFiltro ?? undefined };
  const periodoValido = inicio <= fim;
  const { data: todos = [], isLoading, error } = trpc.dec.listar.useQuery({ inicio, fim, ...filtroBase }, { enabled: periodoValido });
  const passado = useMemo(() => periodoAnterior(inicio, fim), [inicio, fim]);
  const { data: anteriores = [] } = trpc.dec.listar.useQuery({ ...passado, ...filtroBase }, { enabled: periodoValido });
  const { data: clientesFiltro = [] } = trpc.dec.clientes.useQuery({ pesquisa: buscaClienteFiltro }, { enabled: buscaClienteFiltro.trim().length >= 2 });
  const { data: clientesDestino = [] } = trpc.dec.clientes.useQuery({ pesquisa: buscaCliente }, { enabled: destinoOpen && buscaCliente.trim().length >= 2 });
  const { data: auditoria = [] } = trpc.dec.auditoria.useQuery({ recebimentoId: historicoId ?? 1 }, { enabled: historicoId !== null });
  const operadores = Array.from(new Map(todos.map(l => [l.operadorId, l.operadorNome])).entries());
  const registros = todos.filter(l => operadorFiltro === "all" || l.operadorId === Number(operadorFiltro));
  const anterioresFiltrados = anteriores.filter(l => operadorFiltro === "all" || l.operadorId === Number(operadorFiltro));
  const somar = (lista: typeof registros, chave: "quantidade" | "redirecionadas" | "semAcao" | "inativos" | "pendentes") => lista.reduce((total, linha) => total + linha[chave], 0);
  const total = somar(registros, "quantidade");
  const totalAnterior = somar(anterioresFiltrados, "quantidade");
  const diferenca = totalAnterior ? Math.round((total - totalAnterior) / totalAnterior * 100) : null;
  const porCategoria = Array.from(new Map(registros.map(l => [l.categoriaId, l.categoria])).entries()).map(([id, nome]) => ({ id, nome, total: registros.filter(l => l.categoriaId === id).reduce((n, l) => n + l.quantidade, 0) })).sort((a, b) => b.total - a.total);
  const porDia = Array.from(new Set(registros.map(l => dataExibida(l.dataRecebimento)))).map(data => ({ data, total: registros.filter(l => dataExibida(l.dataRecebimento) === data).reduce((n, l) => n + l.quantidade, 0) }));
  const maxDia = Math.max(1, ...porDia.map(d => d.total));
  const atualizar = () => { void utils.dec.listar.invalidate(); void utils.dec.auditoria.invalidate(); };
  const criar = trpc.dec.criarRecebimento.useMutation({ onSuccess: () => { toast.success("Recebimento registrado."); setRecebimentoOpen(false); atualizar(); }, onError: e => toast.error(e.message) });
  const corrigir = trpc.dec.corrigirRecebimento.useMutation({ onSuccess: () => { toast.success("Correção registrada no histórico."); setRecebimentoOpen(false); atualizar(); }, onError: e => toast.error(e.message) });
  const destinar = trpc.dec.salvarDestinacao.useMutation({ onSuccess: () => { toast.success(destinoId ? "Destinação corrigida." : "Destinação registrada."); setDestinoOpen(false); atualizar(); }, onError: e => toast.error(e.message) });
  const cancelar = trpc.dec.cancelarDestinacao.useMutation({ onSuccess: () => { toast.success("Destinação cancelada; mensagens voltaram a ficar pendentes."); atualizar(); }, onError: e => toast.error(e.message) });
  const abrirRecebimento = (l?: typeof registros[number]) => { setCorrigirId(l?.id ?? null); setCategoriaId(l?.categoriaId?.toString() ?? ""); setDia(l ? chaveDia(l.dataRecebimento) : diaLocal()); setQuantidade(l?.quantidade?.toString() ?? ""); setObservacao(l?.observacao ?? ""); setRecebimentoOpen(true); };
  const abrirDestino = (l: typeof registros[number], d?: typeof registros[number]["destinacoes"][number]) => { setRecebimentoId(l.id); setDestinoId(d?.id); setTipo(d?.tipo ?? "redirecionada_ativo"); setQuantidadeDestino(d?.quantidade?.toString() ?? ""); setDestinoCliente(d?.clienteId ?? null); setBuscaCliente(d?.clienteNome ?? ""); setDestinoObs(d?.observacao ?? ""); setDestinoOpen(true); };
  const recebimentoSelecionado = registros.find(l => l.id === recebimentoId);
  const destinoAnterior = recebimentoSelecionado?.destinacoes.find(d => d.id === destinoId);
  const disponivel = (recebimentoSelecionado?.pendentes ?? 0) + (destinoAnterior?.quantidade ?? 0);
  const resultadosCliente = clientesDestino.filter(c => tipo === "redirecionada_ativo" ? c.ativo : tipo === "arquivada_inativo" ? !c.ativo : true);
  const exportar = () => {
    const cabecalho = ["Data", "Categoria", "Recebidas ou vinculadas", "Redirecionadas", "Arquivadas sem ação", "Clientes inativos", "Pendentes", "Operador", "Lançado em", "Cliente vinculado"];
    const linhas = registros.map(l => [dataExibida(l.dataRecebimento), l.categoria, l.quantidade, l.redirecionadas, l.semAcao, l.inativos, l.pendentes, l.operadorNome, new Date(l.createdAt).toLocaleString("pt-BR"), clienteFiltro ? l.destinacoes.map(d => d.clienteNome).filter(Boolean).join("; ") : ""]);
    const csv = "\uFEFF" + [cabecalho, ...linhas].map(l => l.map(csvSeguro).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `dec-mensagens-${inicio}-a-${fim}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="mx-auto max-w-7xl space-y-7 pb-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[.16em] text-teal-700"><Inbox className="h-3.5 w-3.5" /> Operação DEC</div><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Mensagens recebidas</h1><p className="mt-2 text-sm text-muted-foreground">Registre os totais por categoria e classifique a destinação quando puder.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate("/dec/categorias")} className="gap-2"><Tags className="h-4 w-4" /> Categorias</Button><Button onClick={() => abrirRecebimento()} className="gap-2 bg-teal-700 text-white hover:bg-teal-800"><Plus className="h-4 w-4" /> Lançar recebimentos</Button></div>
    </div>
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
      <div><Label htmlFor="dec-inicio" className="text-xs">De</Label><Input id="dec-inicio" type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></div>
      <div><Label htmlFor="dec-fim" className="text-xs">Até</Label><Input id="dec-fim" type="date" value={fim} onChange={e => setFim(e.target.value)} /></div>
      <div><Label className="text-xs">Categoria</Label><Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="text-xs">Operador do lançamento</Label><Select value={operadorFiltro} onValueChange={setOperadorFiltro}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os operadores</SelectItem>{operadores.map(([id, nome]) => <SelectItem value={String(id)} key={id}>{nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="flex items-end"><Button onClick={exportar} disabled={!registros.length} variant="outline" className="w-full gap-2"><Download className="h-4 w-4" /> Exportar CSV</Button></div>
      <div className="sm:col-span-2 lg:col-span-5"><Label htmlFor="dec-filtro-cliente" className="text-xs">Cliente vinculado (opcional)</Label><div className="flex gap-2"><Input id="dec-filtro-cliente" value={buscaClienteFiltro} onChange={e => { setBuscaClienteFiltro(e.target.value); setClienteFiltro(null); }} placeholder="Buscar razão social ou CNPJ; inclui inativos" />{clienteFiltro && <Button variant="ghost" onClick={() => { setClienteFiltro(null); setBuscaClienteFiltro(""); }}>Limpar</Button>}</div>{buscaClienteFiltro.length >= 2 && !clienteFiltro && <div className="mt-1 max-h-36 overflow-y-auto rounded-md border bg-white">{clientesFiltro.map(c => <button key={c.id} type="button" onClick={() => { setClienteFiltro(c.id); setBuscaClienteFiltro(`${c.razaoSocial} · ${c.cnpj}`); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50">{c.razaoSocial} · {c.cnpj} {!c.ativo && "(inativo)"}</button>)}</div>}</div>
    </CardContent></Card>
    {!periodoValido && <p className="text-sm text-destructive">A data inicial deve ser anterior à data final.</p>}
    {(error || erroCategorias) && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar os dados: {(error || erroCategorias)?.message}</p>}
    {clienteFiltro && <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">Filtro de cliente ativo: os totais abaixo incluem <strong>somente mensagens vinculadas a esse cliente</strong>, não todos os recebimentos dos mesmos lotes.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {([
        { label: clienteFiltro ? "Vinculadas ao cliente" : "Recebidas no período", value: total, icon: Inbox, tone: "text-teal-700 bg-teal-50" },
        { label: "Redirecionadas", value: somar(registros, "redirecionadas"), icon: Send, tone: "text-blue-700 bg-blue-50" },
        { label: "Arquivadas sem ação", value: somar(registros, "semAcao"), icon: Archive, tone: "text-slate-700 bg-slate-100" },
        { label: "Clientes inativos", value: somar(registros, "inativos"), icon: Users, tone: "text-amber-700 bg-amber-50" },
        { label: "A classificar", value: somar(registros, "pendentes"), icon: ClipboardList, tone: "text-orange-700 bg-orange-50" },
      ]).map(item => <Card key={item.label}><CardContent className="p-5"><div className={`mb-4 inline-flex rounded-lg p-2 ${item.tone}`}><item.icon className="h-5 w-5" /></div><p className="text-sm text-muted-foreground">{item.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums text-slate-950">{item.value.toLocaleString("pt-BR")}</p></CardContent></Card>)}
    </div>
    {periodoValido && !error && <DecGraficosDestinacao registros={registros} carregando={isLoading} clienteFiltrado={!!clienteFiltro} />}
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Volume por categoria</h2><Badge variant="outline">{porCategoria.length} categorias</Badge></div>{porCategoria.length ? <div className="space-y-4">{porCategoria.map(c => <div key={c.id}><div className="mb-1 flex justify-between text-sm"><span>{c.nome}</span><strong className="tabular-nums">{c.total}</strong></div><div className="h-2.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.max(2, c.total / Math.max(total, 1) * 100)}%` }} /></div></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhum recebimento neste período.</p>}</CardContent></Card>
      <Card><CardContent className="p-5"><h2 className="font-semibold">Comparativo do período</h2><p className="mt-5 text-xs text-muted-foreground">Período anterior ({dataLocal(passado.inicio).toLocaleDateString("pt-BR")} a {dataLocal(passado.fim).toLocaleDateString("pt-BR")})</p><p className="mt-1 text-3xl font-semibold tabular-nums">{totalAnterior}</p><p className="mt-3 flex items-center gap-1 text-sm">{diferenca === null ? "Sem base anterior para variação percentual" : <>{diferenca >= 0 ? <ArrowUpRight className="h-4 w-4 text-teal-700" /> : <ArrowDownRight className="h-4 w-4 text-orange-700" />}<strong>{diferenca > 0 ? "+" : ""}{diferenca}%</strong> em mensagens recebidas</>}</p></CardContent></Card>
    </div>
    {porDia.length > 0 && <Card><CardContent className="p-5"><h2 className="mb-5 font-semibold">Evolução diária</h2><div className="flex min-h-36 items-end gap-2 overflow-x-auto pb-2">{porDia.map(item => <div key={item.data} className="flex min-w-12 flex-1 flex-col items-center gap-2" title={`${item.data}: ${item.total} mensagens`}><span className="text-xs font-semibold tabular-nums">{item.total}</span><div className="w-full rounded-t-md bg-teal-600/85" style={{ height: `${Math.max(12, item.total / maxDia * 100)}px` }} /><span className="whitespace-nowrap text-[10px] text-muted-foreground">{item.data.slice(0, 5)}</span></div>)}</div></CardContent></Card>}
    <Card><CardContent className="p-0"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">Histórico de lançamentos</h2><p className="text-xs text-muted-foreground">Cada registro mantém operador, horário e alterações auditadas.</p></div><span className="text-sm text-muted-foreground">{registros.length} lançamentos</span></div>
      {isLoading ? <p className="p-8 text-sm text-muted-foreground">Carregando lançamentos...</p> : !registros.length ? <div className="py-12 text-center"><Inbox className="mx-auto mb-3 h-8 w-8 text-teal-600" /><p className="font-medium">Ainda não há recebimentos no período</p><p className="mt-1 text-sm text-muted-foreground">Cadastre uma categoria e registre os totais recebidos no DEC.</p></div> :
      <div className="divide-y">{[...registros].reverse().map(l => <div key={l.id} className="space-y-3 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{l.categoria}</span><Badge variant="secondary">{l.quantidade} {clienteFiltro ? "vinculadas" : "recebidas"}</Badge>{l.pendentes > 0 && <Badge variant="outline" className="border-orange-300 text-orange-700">{l.pendentes} a classificar</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">Recebidas em {dataExibida(l.dataRecebimento)} · Lançadas por {l.operadorNome} em {new Date(l.createdAt).toLocaleString("pt-BR")}</p>{l.observacao && <p className="mt-2 text-sm text-muted-foreground">{l.observacao}</p>}</div><div className="flex flex-wrap gap-2">{!clienteFiltro && <><Button size="sm" variant="outline" onClick={() => abrirDestino(l)} disabled={l.pendentes === 0}>Destinar</Button><Button size="sm" variant="ghost" onClick={() => abrirRecebimento(l)}>Corrigir total</Button></>}<Button size="sm" variant="ghost" onClick={() => setHistoricoId(l.id)} className="gap-1"><History className="h-4 w-4" /> Histórico</Button></div></div>
        <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">{l.redirecionadas} redirecionadas</span><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{l.semAcao} sem ação</span><span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{l.inativos} inativos</span></div>
        {l.destinacoes.length > 0 && <div className="divide-y rounded-lg border bg-slate-50/60">{l.destinacoes.map(d => <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"><div><strong>{d.quantidade}</strong> · {tipos[d.tipo]} {d.clienteNome && <>· {d.clienteNome}</>}{d.observacao && <span className="text-muted-foreground"> · {d.observacao}</span>}<p className="text-xs text-muted-foreground">{d.operadorNome} · {new Date(d.updatedAt).toLocaleString("pt-BR")}</p></div>{!clienteFiltro && <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => abrirDestino(l, d)}>Corrigir</Button><Button variant="ghost" size="sm" disabled={cancelar.isPending} onClick={() => { if (confirm(`Cancelar esta destinação de ${d.quantidade} mensagem(ns)? Elas voltarão a ficar pendentes e o histórico será preservado.`)) cancelar.mutate({ id: d.id, recebimentoId: l.id }); }}>Cancelar</Button></div>}</div>)}</div>}
      </div>)}</div>}
    </CardContent></Card>
    <Dialog open={recebimentoOpen} onOpenChange={setRecebimentoOpen}><DialogContent><DialogHeader><DialogTitle>{corrigirId ? "Corrigir lançamento" : "Lançar mensagens recebidas"}</DialogTitle><DialogDescription>{corrigirId ? "A alteração será registrada na auditoria; não é possível reduzir abaixo do total já destinado." : "Informe quantas mensagens chegaram no DEC em uma categoria e data."}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={e => { e.preventDefault(); const q = Number(quantidade); if (!Number.isInteger(q) || q < 1) return toast.error("Informe uma quantidade válida."); if (corrigirId) corrigir.mutate({ id: corrigirId, quantidade: q, observacao: observacao || null }); else criar.mutate({ categoriaId: Number(categoriaId), dia, quantidade: q, observacao: observacao || null }); }}>
      <div className="space-y-2"><Label>Categoria</Label><Select value={categoriaId} disabled={!!corrigirId} onValueChange={setCategoriaId}><SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger><SelectContent>{categorias.filter(c => c.ativa || c.id === Number(categoriaId)).map(c => <SelectItem value={String(c.id)} key={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="dec-dia">Data do recebimento</Label><Input id="dec-dia" type="date" required disabled={!!corrigirId} value={dia} onChange={e => setDia(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="dec-qtd">Quantidade recebida</Label><Input id="dec-qtd" type="number" required min={1} max={1000000} step={1} value={quantidade} onChange={e => setQuantidade(e.target.value)} /></div></div>
      {!corrigirId && categoriaId && registros.some(l => l.categoriaId === Number(categoriaId) && chaveDia(l.dataRecebimento) === dia) && <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">Já existe lançamento para essa categoria e data no período filtrado. Confira se o novo número é adicional; ele não substituirá o anterior.</p>}
      <div className="space-y-2"><Label htmlFor="dec-obs">Observação (opcional)</Label><Input id="dec-obs" maxLength={1000} value={observacao} onChange={e => setObservacao(e.target.value)} /></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setRecebimentoOpen(false)}>Cancelar</Button><Button type="submit" disabled={!categoriaId || criar.isPending || corrigir.isPending}>{corrigirId ? "Salvar correção" : "Registrar recebimento"}</Button></div>
    </form></DialogContent></Dialog>
    <Dialog open={destinoOpen} onOpenChange={setDestinoOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{destinoId ? "Corrigir destinação" : "Destinar mensagens"}</DialogTitle><DialogDescription>{recebimentoSelecionado?.categoria} · {disponivel} mensagem(ns) disponível(is) para este registro.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!recebimentoId) return; destinar.mutate({ id: destinoId, recebimentoId, tipo, quantidade: Number(quantidadeDestino), clienteId: destinoCliente, observacao: destinoObs || null }); }}>
      <div className="space-y-2"><Label>Destinação</Label><Select value={tipo} onValueChange={v => { setTipo(v as Tipo); setDestinoCliente(null); setBuscaCliente(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(tipos).map(([valor, rotulo]) => <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="dec-dest-qtd">Quantidade</Label><Input id="dec-dest-qtd" required type="number" min={1} max={disponivel} step={1} value={quantidadeDestino} onChange={e => setQuantidadeDestino(e.target.value)} /></div>
      {tipo !== "arquivada_sem_acao" && <div className="space-y-2"><Label htmlFor="dec-cliente">{tipo === "redirecionada_ativo" ? "Cliente ativo (obrigatório)" : "Cliente inativo (opcional)"}</Label><Input id="dec-cliente" value={buscaCliente} onChange={e => { setBuscaCliente(e.target.value); setDestinoCliente(null); }} placeholder="Busque por empresa ou CNPJ" />{destinoCliente && <p className="text-xs text-teal-700">Cliente selecionado</p>}{tipo === "arquivada_inativo" && !destinoCliente && <p className="text-xs text-muted-foreground">Caso o cliente inativo não esteja cadastrado, deixe este campo vazio e registre detalhes na observação.</p>}{buscaCliente.length >= 2 && !destinoCliente && <div className="max-h-36 overflow-y-auto rounded-md border">{resultadosCliente.map(c => <button type="button" key={c.id} onClick={() => { setDestinoCliente(c.id); setBuscaCliente(`${c.razaoSocial} · ${c.cnpj}`); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50">{c.razaoSocial} · {c.cnpj}</button>)}{!resultadosCliente.length && <p className="p-3 text-sm text-muted-foreground">Nenhum cliente com este status encontrado.</p>}</div>}</div>}
      <div className="space-y-2"><Label htmlFor="dec-dest-obs">Observação (opcional)</Label><Input id="dec-dest-obs" maxLength={1000} value={destinoObs} onChange={e => setDestinoObs(e.target.value)} /></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDestinoOpen(false)}>Cancelar</Button><Button type="submit" disabled={destinar.isPending || (!destinoCliente && tipo === "redirecionada_ativo") || !quantidadeDestino || Number(quantidadeDestino) > disponivel}>Salvar destinação</Button></div>
    </form></DialogContent></Dialog>
    <Dialog open={historicoId !== null} onOpenChange={open => { if (!open) setHistoricoId(null); }}><DialogContent className="max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>Trilha de auditoria</DialogTitle><DialogDescription>Criação e correções do lançamento e de suas destinações.</DialogDescription></DialogHeader><div className="space-y-3">{auditoria.map(a => <div key={a.id} className="rounded-lg border p-3 text-sm"><p className="font-medium capitalize">{a.entidade} {a.acao}</p><p className="text-xs text-muted-foreground">{a.operadorNome} · {new Date(a.createdAt).toLocaleString("pt-BR")}</p>{a.antes && <p className="mt-2 break-all text-xs text-muted-foreground">Anterior: {a.antes}</p>}{a.depois && <p className="mt-1 break-all text-xs">Novo: {a.depois}</p>}</div>)}{!auditoria.length && <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>}</div></DialogContent></Dialog>
  </div>;
}
