import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportarPdfPendencias } from "@/lib/exportarPdfPendencias";
import { lerFiltrosRelatorioPendencias } from "@/lib/pendenciasRelatorio";

const STATUS = {
  sem_contato: "Sem contato",
  cliente_contatado: "Cliente contatado",
  contato_sem_retorno: "Contato sem retorno",
  fase_ajustes: "Fase de ajustes",
  aprovacao_minuta: "Aprovação de minuta",
  links_enviados: "Links enviados",
  assinado_parcial: "Assinado parcial",
  assinado_total: "Assinado total",
} as const;
const TIPOS = {
  prestacao_servico: "Prestação de serviço",
  coworking: "Coworking",
} as const;
type Status = keyof typeof STATUS;
type Tipo = keyof typeof TIPOS;

function dataLocal(valor: string) {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}
function dataHora(valor: Date | string) {
  return new Date(valor).toLocaleString("pt-BR");
}
function formatarCnpj(cnpj: string) {
  const digitos = cnpj.replace(/\D/g, "");
  return digitos.length === 14 ? digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : cnpj;
}
function dividir<T>(itens: T[], tamanho: number) {
  return Array.from({ length: Math.ceil(itens.length / tamanho) }, (_, indice) => itens.slice(indice * tamanho, (indice + 1) * tamanho));
}

export default function PendenciasRelatorio() {
  const [, navegar] = useLocation();
  const [filtros, setFiltros] = useState(() => lerFiltrosRelatorioPendencias(window.location.search));
  const [geradoEm] = useState(() => new Date());
  const [exportando, setExportando] = useState(false);
  const tentativaAutomatica = useRef(false);
  const relatorioRef = useRef<HTMLDivElement>(null);
  const periodoValido = filtros.inicio <= filtros.fim;
  const input = {
    inicio: filtros.inicio,
    fim: filtros.fim,
    status: filtros.status as Status | undefined,
    tipo: filtros.tipo as Tipo | undefined,
  };
  const { data, isLoading, error } = trpc.pendenciasContrato.relatorio.useQuery(input, { enabled: periodoValido });
  const pronto = periodoValido && !isLoading && !error && !!data;

  const baixar = useCallback(async () => {
    if (!pronto || !relatorioRef.current || exportando) return;
    setExportando(true);
    try {
      await exportarPdfPendencias(relatorioRef.current, `pendencias-contrato-${filtros.inicio}-a-${filtros.fim}.pdf`);
      toast.success("Relatório PDF gerado com os filtros selecionados.");
    } catch (falha) {
      toast.error(falha instanceof Error ? falha.message : "Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setExportando(false);
    }
  }, [exportando, filtros.fim, filtros.inicio, pronto]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("baixar") !== "1" || !pronto || tentativaAutomatica.current) return;
    const timer = window.setTimeout(() => {
      if (tentativaAutomatica.current) return;
      tentativaAutomatica.current = true;
      void baixar();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [baixar, pronto]);

  const pendenciasPorPagina = useMemo(() => dividir(data?.pendencias ?? [], 25), [data?.pendencias]);
  const movimentosPorPagina = useMemo(() => dividir(data?.movimentacoes ?? [], 22), [data?.movimentacoes]);
  const filtroStatus = filtros.status ? STATUS[filtros.status as Status] : "Todos os status";
  const filtroTipo = filtros.tipo ? TIPOS[filtros.tipo as Tipo] : "Todos os tipos";

  return <div className="mx-auto max-w-6xl space-y-4 pb-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" onClick={() => navegar("/pendencias-contrato")} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar ao painel</Button>
      <Button onClick={() => { tentativaAutomatica.current = true; void baixar(); }} disabled={!pronto || exportando} className="gap-2 bg-violet-700 text-white hover:bg-violet-800">
        {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {exportando ? "Preparando PDF..." : "Baixar PDF"}
      </Button>
    </div>
    <p className="text-sm text-muted-foreground">Selecione o período e os filtros. O PDF reúne a fotografia atual das pendências e as movimentações registradas dentro do período.</p>
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div><Label htmlFor="pendencias-relatorio-inicio" className="text-xs">De</Label><Input id="pendencias-relatorio-inicio" type="date" value={filtros.inicio} onChange={(e) => setFiltros((atual) => ({ ...atual, inicio: e.target.value }))} /></div>
      <div><Label htmlFor="pendencias-relatorio-fim" className="text-xs">Até</Label><Input id="pendencias-relatorio-fim" type="date" value={filtros.fim} onChange={(e) => setFiltros((atual) => ({ ...atual, fim: e.target.value }))} /></div>
      <div><Label className="text-xs">Status atual</Label><Select value={filtros.status ?? "all"} onValueChange={(status) => setFiltros((atual) => ({ ...atual, status: status === "all" ? undefined : status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(STATUS).map(([status, label]) => <SelectItem key={status} value={status}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="text-xs">Tipo de contrato</Label><Select value={filtros.tipo ?? "all"} onValueChange={(tipo) => setFiltros((atual) => ({ ...atual, tipo: tipo === "all" ? undefined : tipo }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{Object.entries(TIPOS).map(([tipo, label]) => <SelectItem key={tipo} value={tipo}>{label}</SelectItem>)}</SelectContent></Select></div>
    </CardContent></Card>
    {!periodoValido && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">A data inicial não pode ser posterior à data final.</p>}
    {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar os dados para o relatório: {error.message}</p>}
    {!error && !pronto && periodoValido && <p className="text-sm text-muted-foreground">Carregando informações do relatório...</p>}
    {pronto && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><div ref={relatorioRef} className="w-[940px] space-y-5 bg-white p-6 text-slate-900" aria-label="Relatório do Gestor de Pendências">
      <header data-pendencias-pdf-secao className="space-y-4 rounded-xl bg-slate-900 px-7 py-6 text-white">
        <div className="flex items-center justify-between gap-4"><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-200">MJP Controller · Contratos e assinaturas</p><p className="text-xs text-slate-200">Emitido em {geradoEm.toLocaleString("pt-BR")}</p></div>
        <div><h1 className="text-3xl font-semibold tracking-tight">Relatório periódico de pendências</h1><p className="mt-2 text-sm text-slate-200">Período de {dataLocal(filtros.inicio)} a {dataLocal(filtros.fim)}</p></div>
        <div className="grid grid-cols-2 gap-3 border-t border-white/20 pt-4 text-xs"><p><span className="block text-slate-300">Status atual</span><strong className="font-semibold">{filtroStatus}</strong></p><p><span className="block text-slate-300">Tipo de contrato</span><strong className="font-semibold">{filtroTipo}</strong></p></div>
      </header>
      <section data-pendencias-pdf-secao aria-label="Indicadores principais" className="grid grid-cols-3 gap-3">
        {[
          { label: "Pendências ativas", valor: data.resumo.totalPendencias, cor: "text-violet-700" },
          { label: "Em aberto", valor: data.resumo.abertas, cor: "text-amber-700" },
          { label: "Movimentações no período", valor: data.resumo.movimentacoesNoPeriodo, cor: "text-blue-700" },
          { label: "Atualizações manuais", valor: data.resumo.movimentacoesManuais, cor: "text-indigo-700" },
          { label: "Transições automáticas", valor: data.resumo.movimentacoesAutomaticas, cor: "text-slate-700" },
          { label: "Assinados totalmente", valor: data.resumo.assinaturasTotaisNoPeriodo, cor: "text-emerald-700" },
        ].map((item) => <Card key={item.label} className="shadow-none"><CardContent className="p-4"><p className="text-xs text-slate-600">{item.label}</p><p className={`mt-2 text-3xl font-bold tabular-nums ${item.cor}`}>{item.valor.toLocaleString("pt-BR")}</p></CardContent></Card>)}
      </section>
      <section data-pendencias-pdf-secao className="grid grid-cols-2 gap-4" aria-label="Distribuição atual">
        <Card className="shadow-none"><CardContent className="p-5"><h2 className="font-semibold">Distribuição por etapa</h2><p className="mb-4 text-xs text-slate-600">Fotografia atual das pendências filtradas</p><div className="space-y-3">{Object.entries(STATUS).map(([status, label]) => { const total = data.resumo.porStatus[status] ?? 0; const percentual = data.resumo.totalPendencias ? total / data.resumo.totalPendencias * 100 : 0; return <div key={status}><div className="flex justify-between gap-3 text-sm"><span>{label}</span><strong>{total}</strong></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.max(total ? 3 : 0, percentual)}%` }} /></div></div>; })}</div></CardContent></Card>
        <Card className="shadow-none"><CardContent className="p-5"><h2 className="font-semibold">Distribuição por contrato</h2><p className="mb-4 text-xs text-slate-600">Pendências ativas incluídas no relatório</p><div className="space-y-5">{Object.entries(TIPOS).map(([tipo, label]) => { const total = data.resumo.porTipo[tipo] ?? 0; const percentual = data.resumo.totalPendencias ? total / data.resumo.totalPendencias * 100 : 0; return <div key={tipo}><div className="flex justify-between text-sm"><span>{label}</span><strong>{total}</strong></div><div className="mt-2 h-3 rounded-full bg-slate-100"><div className="h-full rounded-full bg-fuchsia-600" style={{ width: `${Math.max(total ? 3 : 0, percentual)}%` }} /></div><p className="mt-1 text-xs text-slate-600">{Math.round(percentual)}% do total</p></div>; })}</div></CardContent></Card>
      </section>
      {pendenciasPorPagina.map((grupo, indice) => <section data-pendencias-pdf-secao key={`pendencias-${indice}`}><Card className="shadow-none"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Pendências ativas</h2><p className="text-xs text-slate-600">Status apresentado na data de emissão</p></div><span className="text-xs text-slate-500">{pendenciasPorPagina.length > 1 ? `Parte ${indice + 1}/${pendenciasPorPagina.length}` : `${grupo.length} registro(s)`}</span></div><table className="w-full text-left text-xs"><thead className="border-b text-slate-600"><tr><th className="pb-2 pr-2">Cliente</th><th className="pb-2 pr-2">CNPJ</th><th className="pb-2 pr-2">Contrato</th><th className="pb-2">Status atual</th></tr></thead><tbody>{grupo.map(({ pendencia, cliente }: any) => <tr key={pendencia.id} className="border-b last:border-0"><td className="py-2 pr-2 font-medium">{cliente.razaoSocial}</td><td className="py-2 pr-2 font-mono text-[11px]">{formatarCnpj(cliente.cnpj)}</td><td className="py-2 pr-2">{TIPOS[pendencia.tipo as Tipo]}</td><td className="py-2">{STATUS[pendencia.status as Status]}</td></tr>)}</tbody></table></CardContent></Card></section>)}
      {movimentosPorPagina.map((grupo, indice) => <section data-pendencias-pdf-secao key={`movimentos-${indice}`}><Card className="shadow-none"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Movimentações no período</h2><p className="text-xs text-slate-600">Eventos manuais, automáticos e de importação entre as datas selecionadas</p></div><span className="text-xs text-slate-500">{movimentosPorPagina.length > 1 ? `Parte ${indice + 1}/${movimentosPorPagina.length}` : `${grupo.length} evento(s)`}</span></div>{grupo.length ? <div className="divide-y">{grupo.map(({ evento, cliente, pendencia }: any) => <div key={evento.id} className="py-3 first:pt-0"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">{cliente.razaoSocial}</p><p className="mt-0.5 text-xs text-slate-600">{TIPOS[pendencia.tipo as Tipo]} · {evento.statusAnterior ? `${STATUS[evento.statusAnterior as Status]} → ` : ""}{STATUS[evento.statusNovo as Status]}</p></div><p className="whitespace-nowrap text-xs text-slate-600">{dataHora(evento.createdAt)}</p></div>{evento.justificativa && <p className="mt-1.5 text-xs text-slate-700">{evento.justificativa}</p>}<p className="mt-1 text-[11px] text-slate-500">{evento.tipoEvento === "automatico" ? "Movimentação automática" : evento.tipoEvento === "importacao" ? "Importação" : `Responsável: ${evento.usuarioNome ?? "Usuário"}`}</p></div>)}</div> : <p className="text-sm text-slate-600">Nenhuma movimentação encontrada no período selecionado.</p>}</CardContent></Card></section>)}
      <div data-pendencias-pdf-secao className="border-t border-slate-200 pt-3 text-xs text-slate-600">Fonte: Gestor de Pendências de Contrato do Portal Controller. Os indicadores de pendências são uma fotografia atual; a relação de movimentações considera exclusivamente o período selecionado.</div>
    </div></div>}
  </div>;
}
