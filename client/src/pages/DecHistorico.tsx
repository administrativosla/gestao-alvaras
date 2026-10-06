import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DecDestinacaoCampos, destinoVazioDec, type DestinacaoFormDec } from "@/components/DecDestinacaoCampos";
import { TIPOS_DESTINACAO_DEC } from "@shared/decTipos";
import { csvSeguro, dataExibida, diaLocal } from "@/lib/decFormat";
import { ArrowLeft, Download, History, Inbox } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function filtroInicial(nome: string, padrao: string, tipo: "data" | "id") {
  const valor = new URLSearchParams(window.location.search).get(nome);
  if (tipo === "id") return valor && /^[1-9]\d*$/.test(valor) ? valor : padrao;
  const data = valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00Z`) : null;
  return data && !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor ? valor : padrao;
}

export default function DecHistorico() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [inicio, setInicio] = useState(() => filtroInicial("inicio", diaLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), "data"));
  const [fim, setFim] = useState(() => filtroInicial("fim", diaLocal(), "data"));
  const [categoriaFiltro, setCategoriaFiltro] = useState(() => filtroInicial("categoriaId", "all", "id"));
  const [operadorFiltro, setOperadorFiltro] = useState(() => filtroInicial("operadorId", "all", "id"));
  const [buscaFiltro, setBuscaFiltro] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState<number | null>(null);
  const [corrigirId, setCorrigirId] = useState<number | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [destino, setDestino] = useState<{ recebimentoId: number; id?: number } | null>(null);
  const [camposDestino, setCamposDestino] = useState<DestinacaoFormDec>(() => destinoVazioDec());
  const [auditoriaId, setAuditoriaId] = useState<number | null>(null);
  const periodoValido = inicio <= fim;
  const { data: categorias = [] } = trpc.dec.categorias.useQuery();
  const { data: todos = [], isLoading, error } = trpc.dec.listar.useQuery({ inicio, fim, categoriaId: categoriaFiltro === "all" ? undefined : Number(categoriaFiltro), clienteId: clienteFiltro ?? undefined }, { enabled: periodoValido });
  const { data: clientesFiltro = [] } = trpc.dec.clientes.useQuery({ pesquisa: buscaFiltro }, { enabled: buscaFiltro.trim().length >= 2 && !clienteFiltro });
  const { data: auditoria = [] } = trpc.dec.auditoria.useQuery({ recebimentoId: auditoriaId ?? 1 }, { enabled: auditoriaId !== null });
  const operadores = Array.from(new Map(todos.map(l => [l.operadorId, l.operadorNome])).entries());
  const registros = todos.filter(l => operadorFiltro === "all" || l.operadorId === Number(operadorFiltro));
  const registroCorrigir = registros.find(l => l.id === corrigirId);
  const registroDestino = registros.find(l => l.id === destino?.recebimentoId);
  const destinoAnterior = registroDestino?.destinacoes.find(d => d.id === destino?.id);
  const disponivel = (registroDestino?.pendentes ?? 0) + (destinoAnterior?.quantidade ?? 0);
  const alocadas = registroCorrigir ? registroCorrigir.quantidade - registroCorrigir.pendentes : 0;
  const atualizar = () => { void utils.dec.listar.invalidate(); void utils.dec.auditoria.invalidate(); };
  const corrigir = trpc.dec.corrigirRecebimento.useMutation({ onSuccess: () => { toast.success("Total corrigido com trilha de auditoria."); setCorrigirId(null); atualizar(); }, onError: erro => toast.error(erro.message) });
  const salvarDestino = trpc.dec.salvarDestinacao.useMutation({ onSuccess: () => { toast.success("Destinação registrada no histórico."); setDestino(null); atualizar(); }, onError: erro => toast.error(erro.message) });
  const cancelar = trpc.dec.cancelarDestinacao.useMutation({ onSuccess: () => { toast.success("Destinação cancelada; mensagens voltaram a ficar pendentes."); atualizar(); }, onError: erro => toast.error(erro.message) });

  const abrirDestino = (l: typeof registros[number], d?: typeof registros[number]["destinacoes"][number]) => {
    setDestino({ recebimentoId: l.id, id: d?.id });
    setCamposDestino(d ? { tipo: d.tipo, quantidade: String(d.quantidade), clienteId: d.clienteId, clienteNome: d.clienteNome ?? "", observacao: d.observacao ?? "" } : destinoVazioDec());
  };
  const exportar = () => {
    const cabecalho = ["Data", "Categoria", "Recebidas ou vinculadas", "Enviadas a clientes (inclui Várias)", "Destas: Várias (não somar)", "Encaminhadas ao time interno", "Arquivadas sem ação", "Clientes inativos", "Pendentes", "Operador", "Lançado em", "Cliente vinculado"];
    const linhas = registros.map(l => [dataExibida(l.dataRecebimento), l.categoria, l.quantidade, l.redirecionadas, l.varias, l.internas, l.semAcao, l.inativos, l.pendentes, l.operadorNome, new Date(l.createdAt).toLocaleString("pt-BR"), clienteFiltro ? l.destinacoes.map(d => d.clienteNome).filter(Boolean).join("; ") : ""]);
    const csv = "\uFEFF" + [cabecalho, ...linhas].map(l => l.map(csvSeguro).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `dec-mensagens-${inicio}-a-${fim}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <div className="mx-auto max-w-7xl space-y-6 pb-10">
    <div><Button variant="ghost" size="sm" className="mb-3 gap-1 px-0" onClick={() => navigate("/dec")}><ArrowLeft className="h-4 w-4" /> Painel DEC</Button><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Histórico de lançamentos</h1><p className="mt-1 text-sm text-muted-foreground">Consulte os recebimentos, classifique pendências e acompanhe cada alteração.</p></div><Button variant="outline" className="gap-2" onClick={exportar} disabled={!registros.length}><Download className="h-4 w-4" /> Exportar CSV</Button></div></div>
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div><Label htmlFor="hist-inicio" className="text-xs">De</Label><Input id="hist-inicio" type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></div>
      <div><Label htmlFor="hist-fim" className="text-xs">Até</Label><Input id="hist-fim" type="date" value={fim} onChange={e => setFim(e.target.value)} /></div>
      <div><Label className="text-xs">Categoria</Label><Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="text-xs">Operador do lançamento</Label><Select value={operadorFiltro} onValueChange={setOperadorFiltro}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os operadores</SelectItem>{operadores.map(([id, nome]) => <SelectItem key={id} value={String(id)}>{nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="sm:col-span-2 lg:col-span-4"><Label htmlFor="hist-cliente" className="text-xs">Cliente vinculado (opcional)</Label><div className="flex gap-2"><Input id="hist-cliente" value={buscaFiltro} onChange={e => { setBuscaFiltro(e.target.value); setClienteFiltro(null); }} placeholder="Buscar razão social ou CNPJ; inclui inativos" />{clienteFiltro && <Button variant="ghost" onClick={() => { setClienteFiltro(null); setBuscaFiltro(""); }}>Limpar</Button>}</div>{buscaFiltro.trim().length >= 2 && !clienteFiltro && <div className="mt-1 max-h-36 overflow-y-auto rounded-md border bg-white">{clientesFiltro.map(c => <button key={c.id} type="button" onClick={() => { setClienteFiltro(c.id); setBuscaFiltro(`${c.razaoSocial} · ${c.cnpj}`); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50">{c.razaoSocial} · {c.cnpj} {!c.ativo && "(inativo)"}</button>)}</div>}</div>
    </CardContent></Card>
    {!periodoValido && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">A data inicial deve ser anterior à data final.</p>}
    {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Não foi possível carregar o histórico: {error.message}</p>}
    {clienteFiltro && <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">Exibindo apenas mensagens vinculadas a este cliente. Envios em grupo para Várias não têm vínculo individual e não aparecem neste filtro. Limpe-o para corrigir totais ou destinações do lote.</p>}
    <Card><CardContent className="p-0"><div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4"><div><h2 className="font-semibold">Lançamentos do período</h2><p className="text-xs text-muted-foreground">Operador, horário e alterações preservados na auditoria.</p></div><span className="text-sm text-muted-foreground">{registros.length} lançamento(s)</span></div>
      {isLoading ? <p className="p-8 text-sm text-muted-foreground">Carregando lançamentos...</p> : !registros.length ? <div className="py-12 text-center"><Inbox className="mx-auto mb-3 h-8 w-8 text-teal-600" /><p className="font-medium">Nenhum recebimento para os filtros selecionados</p><p className="mt-1 text-sm text-muted-foreground">Confira o período e a categoria, ou registre um recebimento no painel DEC.</p></div> :
        <div className="divide-y">{[...registros].reverse().map(l => <div key={l.id} className="space-y-3 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{l.categoria}</span><Badge variant="secondary">{l.quantidade} {clienteFiltro ? "vinculadas" : "recebidas"}</Badge>{l.pendentes > 0 && <Badge variant="outline" className="border-orange-300 text-orange-700">{l.pendentes} a classificar</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">Recebidas em {dataExibida(l.dataRecebimento)} · Lançadas por {l.operadorNome} em {new Date(l.createdAt).toLocaleString("pt-BR")}</p>{l.observacao && <p className="mt-2 text-sm text-muted-foreground">{l.observacao}</p>}</div><div className="flex flex-wrap gap-2">{!clienteFiltro && <><Button size="sm" variant="outline" onClick={() => abrirDestino(l)} disabled={!l.pendentes}>Classificar destino</Button><Button size="sm" variant="ghost" onClick={() => { setCorrigirId(l.id); setQuantidade(String(l.quantidade)); setObservacao(l.observacao ?? ""); }}>Corrigir total</Button></>}<Button size="sm" variant="ghost" onClick={() => setAuditoriaId(l.id)} className="gap-1"><History className="h-4 w-4" /> Auditoria</Button></div></div>
          <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">{l.redirecionadas} enviadas a clientes</span>{l.varias > 0 && <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-800">{l.varias} em Várias (incluídas)</span>}<span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-800">{l.internas} time interno</span><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{l.semAcao} sem ação</span><span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{l.inativos} inativos</span></div>
          {l.destinacoes.length > 0 && <div className="divide-y rounded-lg border bg-slate-50/60">{l.destinacoes.map(d => <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"><div><strong>{d.quantidade}</strong> · {TIPOS_DESTINACAO_DEC[d.tipo]} {d.clienteNome && <>· {d.clienteNome}</>}{d.observacao && <span className="text-muted-foreground"> · {d.observacao}</span>}<p className="text-xs text-muted-foreground">{d.operadorNome} · {new Date(d.updatedAt).toLocaleString("pt-BR")}</p></div>{!clienteFiltro && <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => abrirDestino(l, d)}>Corrigir</Button><Button variant="ghost" size="sm" disabled={cancelar.isPending} onClick={() => { if (confirm(`Cancelar esta destinação de ${d.quantidade} mensagem(ns)? Elas voltarão a ficar pendentes e o histórico será preservado.`)) cancelar.mutate({ id: d.id, recebimentoId: l.id }); }}>Cancelar</Button></div>}</div>)}</div>}
        </div>)}</div>}
    </CardContent></Card>
    <Dialog open={corrigirId !== null} onOpenChange={aberto => { if (!aberto) setCorrigirId(null); }}><DialogContent><DialogHeader><DialogTitle>Corrigir total recebido</DialogTitle><DialogDescription>A alteração será auditada. O novo total não pode ser inferior às {alocadas} mensagens já destinadas.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (corrigirId !== null) corrigir.mutate({ id: corrigirId, quantidade: Number(quantidade), observacao: observacao || null }); }}><div className="space-y-2"><Label htmlFor="dec-corrigir-qtd">Quantidade recebida</Label><Input id="dec-corrigir-qtd" type="number" required min={Math.max(1, alocadas)} max={1000000} step={1} value={quantidade} onChange={e => setQuantidade(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="dec-corrigir-obs">Observação</Label><Input id="dec-corrigir-obs" maxLength={1000} value={observacao} onChange={e => setObservacao(e.target.value)} /></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCorrigirId(null)}>Cancelar</Button><Button type="submit" disabled={corrigir.isPending}>Salvar correção</Button></div></form></DialogContent></Dialog>
    <Dialog open={destino !== null} onOpenChange={aberto => { if (!aberto) setDestino(null); }}><DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>{destino?.id ? "Corrigir destinação" : "Classificar mensagens"}</DialogTitle><DialogDescription>{registroDestino?.categoria} · {disponivel} mensagem(ns) disponível(is) neste lançamento.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!destino) return; const qtd = Number(camposDestino.quantidade); if (!Number.isInteger(qtd) || qtd < 1 || qtd > disponivel) return toast.error("Informe uma quantidade dentro do saldo disponível."); if (camposDestino.tipo === "redirecionada_ativo" && !camposDestino.clienteId) return toast.error("Selecione um cliente ativo."); salvarDestino.mutate({ ...destino, tipo: camposDestino.tipo, quantidade: qtd, clienteId: camposDestino.clienteId, observacao: camposDestino.observacao || null }); }}><DecDestinacaoCampos prefix="dec-hist" value={camposDestino} onChange={setCamposDestino} max={disponivel} /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDestino(null)}>Cancelar</Button><Button type="submit" disabled={salvarDestino.isPending || !registroDestino || (camposDestino.tipo === "redirecionada_ativo" && !camposDestino.clienteId)}>Salvar destinação</Button></div></form></DialogContent></Dialog>
    <Dialog open={auditoriaId !== null} onOpenChange={aberto => { if (!aberto) setAuditoriaId(null); }}><DialogContent className="max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>Trilha de auditoria</DialogTitle><DialogDescription>Criação e correções do lançamento e de suas destinações.</DialogDescription></DialogHeader><div className="space-y-3">{auditoria.map(a => <div key={a.id} className="rounded-lg border p-3 text-sm"><p className="font-medium capitalize">{a.entidade} {a.acao}</p><p className="text-xs text-muted-foreground">{a.operadorNome} · {new Date(a.createdAt).toLocaleString("pt-BR")}</p>{a.antes && <p className="mt-2 break-all text-xs text-muted-foreground">Anterior: {a.antes}</p>}{a.depois && <p className="mt-1 break-all text-xs">Novo: {a.depois}</p>}</div>)}{!auditoria.length && <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>}</div></DialogContent></Dialog>
  </div>;
}
