import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DecGraficosDestinacao from "@/components/DecGraficosDestinacao";
import { dataExibida, dataLocal, periodoAnterior } from "@/lib/decFormat";
import { lerFiltrosRelatorioDec } from "@/lib/decRelatorio";
import { exportarPdfDec } from "@/lib/exportarPdfDec";

const numero = (valor: number) => valor.toLocaleString("pt-BR");
const periodo = (inicio: string, fim: string) => `${dataLocal(inicio).toLocaleDateString("pt-BR")} a ${dataLocal(fim).toLocaleDateString("pt-BR")}`;

export default function DecRelatorio() {
  const [, navigate] = useLocation();
  const [filtros] = useState(() => lerFiltrosRelatorioDec(window.location.search));
  const [geradoEm] = useState(() => new Date());
  const [exportando, setExportando] = useState(false);
  const tentativaAutomatica = useRef(false);
  const relatorioRef = useRef<HTMLDivElement>(null);
  const periodoValido = filtros.inicio <= filtros.fim;
  const { data: categorias = [], isLoading: carregandoCategorias, error: erroCategorias } = trpc.dec.categorias.useQuery();
  const { data: todos = [], isLoading: carregando, error } = trpc.dec.listar.useQuery({ inicio: filtros.inicio, fim: filtros.fim, categoriaId: filtros.categoriaId, clienteId: filtros.clienteId }, { enabled: periodoValido });
  const anterior = useMemo(() => periodoValido ? periodoAnterior(filtros.inicio, filtros.fim) : { inicio: filtros.inicio, fim: filtros.fim }, [filtros, periodoValido]);
  const { data: passados = [], isLoading: carregandoAnterior, error: erroAnterior } = trpc.dec.listar.useQuery({ ...anterior, categoriaId: filtros.categoriaId, clienteId: filtros.clienteId }, { enabled: periodoValido });
  const { data: cliente, isLoading: carregandoCliente, error: erroCliente } = trpc.clientes.get.useQuery({ id: filtros.clienteId ?? 1 }, { enabled: !!filtros.clienteId });
  const registros = todos.filter(l => !filtros.operadorId || l.operadorId === filtros.operadorId);
  const anteriores = passados.filter(l => !filtros.operadorId || l.operadorId === filtros.operadorId);
  const total = registros.reduce((n, l) => n + l.quantidade, 0);
  const totalAnterior = anteriores.reduce((n, l) => n + l.quantidade, 0);
  const diferenca = totalAnterior ? Math.round((total - totalAnterior) / totalAnterior * 100) : null;
  const categoria = categorias.find(c => c.id === filtros.categoriaId)?.nome ?? (filtros.categoriaId ? `Categoria #${filtros.categoriaId}` : "Todas as categorias");
  const operador = registros.find(l => l.operadorId === filtros.operadorId)?.operadorNome ?? (filtros.operadorId ? `Operador #${filtros.operadorId}` : "Todos os operadores");
  const somar = (campo: "redirecionadas" | "varias" | "internas" | "semAcao" | "inativos" | "pendentes") => registros.reduce((n, l) => n + l[campo], 0);
  const volumes = Array.from(new Map(registros.map(l => [l.categoriaId, l.categoria])).entries())
    .map(([id, nome]) => ({ id, nome, total: registros.filter(l => l.categoriaId === id).reduce((n, l) => n + l.quantidade, 0) }))
    .sort((a, b) => b.total - a.total);
  const evolucao = Array.from(new Set(registros.map(l => dataExibida(l.dataRecebimento))))
    .map(data => ({ data, total: registros.filter(l => dataExibida(l.dataRecebimento) === data).reduce((n, l) => n + l.quantidade, 0) }));
  const gruposEvolucao = Array.from({ length: Math.ceil(evolucao.length / 24) }, (_, i) => evolucao.slice(i * 24, (i + 1) * 24));
  const pronto = periodoValido && !carregando && !carregandoCategorias && !carregandoAnterior && (!filtros.clienteId || !carregandoCliente) && !error && !erroAnterior && !erroCategorias && !erroCliente;

  const baixar = useCallback(async () => {
    if (!pronto || !relatorioRef.current || exportando) return;
    setExportando(true);
    try {
      await exportarPdfDec(relatorioRef.current, `painel-dec-${filtros.inicio}-a-${filtros.fim}.pdf`);
      toast.success("Relatório PDF gerado com os filtros selecionados.");
    } catch (falha) {
      toast.error(falha instanceof Error ? falha.message : "Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setExportando(false);
    }
  }, [exportando, filtros, pronto]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("baixar") !== "1" || !pronto || tentativaAutomatica.current) return;
    // Aguarda a medição dos gráficos SVG responsivos antes da captura.
    const timer = window.setTimeout(() => {
      if (tentativaAutomatica.current) return;
      tentativaAutomatica.current = true;
      void baixar();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [baixar, pronto]);

  const erroDados = error || erroAnterior || erroCategorias || erroCliente;
  return <div className="mx-auto max-w-6xl space-y-4 pb-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" onClick={() => navigate("/dec")} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar ao painel DEC</Button>
      <Button onClick={() => { tentativaAutomatica.current = true; void baixar(); }} disabled={!pronto || exportando} className="gap-2 bg-teal-700 text-white hover:bg-teal-800">
        {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {exportando ? "Preparando PDF..." : "Baixar PDF"}
      </Button>
    </div>
    <p className="text-sm text-muted-foreground">Prévia do documento para compartilhar. O PDF é gerado no seu navegador com os dados e filtros exibidos abaixo.</p>
    <p className="text-xs text-muted-foreground sm:hidden">Deslize a prévia para o lado para inspecionar o relatório inteiro; o arquivo PDF sempre incluirá a página completa.</p>
    {!periodoValido && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">O período inicial não pode ser posterior ao final.</p>}
    {erroDados && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar os dados para o relatório: {erroDados.message}</p>}
    {!erroDados && !pronto && periodoValido && <p className="text-sm text-muted-foreground">Carregando informações e gráficos do relatório...</p>}
    {pronto && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div ref={relatorioRef} className="w-[940px] space-y-5 bg-white p-6 text-slate-900" aria-label="Relatório do Quantificador DEC">
        <header data-dec-pdf-secao className="space-y-4 rounded-xl bg-slate-900 px-7 py-6 text-white">
          <div className="flex items-center justify-between gap-4"><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-200">MJP Controller · Operação DEC</p><p className="text-xs text-slate-200">Emitido em {geradoEm.toLocaleString("pt-BR")}</p></div>
          <div><h1 className="text-3xl font-semibold tracking-tight">Painel de mensagens recebidas</h1><p className="mt-2 text-sm text-slate-200">Relatório quantificador — período de {periodo(filtros.inicio, filtros.fim)}</p></div>
          <div className="grid grid-cols-3 gap-3 border-t border-white/20 pt-4 text-xs"><p><span className="block text-slate-300">Categoria</span><strong className="font-semibold">{categoria}</strong></p><p><span className="block text-slate-300">Operador do lançamento</span><strong className="font-semibold">{operador}</strong></p><p><span className="block text-slate-300">Cliente vinculado</span><strong className="font-semibold">{filtros.clienteId ? (cliente ? `${cliente.razaoSocial} · ${cliente.cnpj}` : `Cliente #${filtros.clienteId}`) : "Todos os clientes"}</strong></p></div>
        </header>
        {filtros.clienteId && <div data-dec-pdf-secao className="rounded-md border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900">Totais limitados às mensagens vinculadas ao cliente selecionado; envios para Várias não são associados individualmente.</div>}
        <section data-dec-pdf-secao aria-label="Indicadores principais" className="grid grid-cols-3 gap-3">
          {[
            { label: filtros.clienteId ? "Vinculadas ao cliente" : "Recebidas no período", valor: total, cor: "text-teal-700" },
            { label: "Enviadas a clientes", valor: somar("redirecionadas"), detalhe: `${somar("varias")} em Várias (incluídas)`, cor: "text-blue-700" },
            { label: "Time interno", valor: somar("internas"), cor: "text-indigo-700" },
            { label: "Arquivadas sem ação", valor: somar("semAcao"), cor: "text-slate-700" },
            { label: "Clientes inativos", valor: somar("inativos"), cor: "text-amber-700" },
            { label: "A classificar", valor: somar("pendentes"), cor: "text-orange-700" },
          ].map(item => <Card key={item.label} className="shadow-none"><CardContent className="p-4"><p className="text-xs text-slate-600">{item.label}</p><p className={`mt-2 text-3xl font-bold tabular-nums ${item.cor}`}>{numero(item.valor)}</p>{"detalhe" in item && item.detalhe && <p className="mt-1 text-xs text-slate-600">{item.detalhe}</p>}</CardContent></Card>)}
        </section>
        <div data-dec-pdf-secao><DecGraficosDestinacao registros={registros} clienteFiltrado={!!filtros.clienteId} modoRelatorio /></div>
        <section data-dec-pdf-secao className="grid grid-cols-[1.6fr_1fr] gap-4" aria-label="Volume por categoria e comparativo">
          <Card className="shadow-none"><CardContent className="p-5"><h2 className="font-semibold">Volume por categoria</h2><p className="mb-4 text-xs text-slate-600">{volumes.length} categoria(s) no período</p>{volumes.length ? <div className="space-y-3">{volumes.map(item => <div key={item.id}><div className="flex justify-between gap-3 text-sm"><span>{item.nome}</span><strong>{numero(item.total)}</strong></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.max(2, item.total / Math.max(total, 1) * 100)}%` }} /></div></div>)}</div> : <p className="text-sm text-slate-600">Nenhum recebimento no período.</p>}</CardContent></Card>
          <Card className="shadow-none"><CardContent className="p-5"><h2 className="font-semibold">Comparativo do período</h2><p className="mt-4 text-xs text-slate-600">Anterior: {periodo(anterior.inicio, anterior.fim)}</p><p className="mt-2 text-3xl font-semibold">{numero(totalAnterior)}</p><p className="mt-3 text-sm">{diferenca === null ? "Sem base anterior para variação percentual" : `${diferenca > 0 ? "+" : ""}${diferenca}% em mensagens recebidas`}</p></CardContent></Card>
        </section>
        {gruposEvolucao.length > 0 && <section aria-label="Evolução diária" className="space-y-3">{gruposEvolucao.map((grupo, i) => {
          const maior = Math.max(1, ...grupo.map(d => d.total));
          return <Card data-dec-pdf-secao key={i} className="shadow-none"><CardContent className="p-5"><h2 className="font-semibold">Evolução diária{gruposEvolucao.length > 1 ? ` · parte ${i + 1}/${gruposEvolucao.length}` : ""}</h2><div className="mt-5 flex min-h-36 items-end gap-1 pb-2">{grupo.map(dia => <div key={dia.data} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${dia.data}: ${dia.total} mensagens`}><span className="text-[11px] font-semibold">{numero(dia.total)}</span><div className="w-full rounded-t bg-teal-600" style={{ height: `${Math.max(12, dia.total / maior * 100)}px` }} /><span className="whitespace-nowrap text-[9px] text-slate-600">{dia.data.slice(0, 5)}</span></div>)}</div></CardContent></Card>;
        })}</section>}
        <div data-dec-pdf-secao className="border-t border-slate-200 pt-3 text-xs text-slate-600">Fonte: lançamentos e classificações registrados no Quantificador DEC. Envio a Várias é subcontagem das mensagens enviadas a clientes, sem multiplicação por empresa. Percentuais consideram apenas mensagens classificadas.</div>
      </div>
    </div>}
  </div>;
}
