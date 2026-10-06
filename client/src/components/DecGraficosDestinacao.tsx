import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Archive, ChartNoAxesCombined, Send, UsersRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { resumirDestinacaoDec, type RegistroDecGraficos } from "@shared/decGraficos";

const CORES = { direcionadas: "#0f766e", internas: "#6366f1", arquivadas: "#d97706" } as const;
const numero = (valor: number) => valor.toLocaleString("pt-BR");

export default function DecGraficosDestinacao({ registros, carregando, clienteFiltrado = false, modoRelatorio = false }: {
  registros: readonly RegistroDecGraficos[];
  carregando?: boolean;
  clienteFiltrado?: boolean;
  modoRelatorio?: boolean;
}) {
  const resumo = resumirDestinacaoDec(registros);
  const dadosRosca = [
    { nome: "Enviadas a clientes (inclui Várias)", quantidade: resumo.direcionadas, percentual: resumo.percentualDirecionadas, cor: CORES.direcionadas },
    { nome: "Encaminhadas ao time interno", quantidade: resumo.internas, percentual: resumo.percentualInternas, cor: CORES.internas },
    { nome: "Arquivadas", quantidade: resumo.arquivadas, percentual: resumo.percentualArquivadas, cor: CORES.arquivadas },
  ].filter(item => item.quantidade > 0);
  const dadosCategorias = resumo.categorias.filter(item => item.classificadas > 0);

  return (
    <section aria-labelledby="dec-graficos-titulo" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2"><ChartNoAxesCombined className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 id="dec-graficos-titulo" className="text-lg font-semibold tracking-tight">Destino das mensagens</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Proporção calculada somente sobre mensagens já classificadas. As pendentes não entram no percentual.</p>
        </div>
        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">{numero(resumo.pendentes)} a classificar</Badge>
      </div>
      <div className={modoRelatorio ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-5" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]"}>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-5 sm:p-6">
          <h3 className="font-semibold">Distribuição das destinações</h3>
          <p className="mt-1 text-xs text-muted-foreground">{clienteFiltrado ? "Mensagens vinculadas ao cliente no período" : "Mensagens classificadas no período"}</p>
          {carregando ? <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">Carregando distribuição...</div> : resumo.classificadas === 0 ?
            <div className="flex h-60 flex-col items-center justify-center gap-3 text-center"><div className="h-28 w-28 rounded-full border-[16px] border-slate-100" aria-hidden="true" /><p className="max-w-64 text-sm text-muted-foreground">Ainda não há mensagens classificadas para gerar a proporção.</p></div> :
            <div className="relative mx-auto h-60 max-w-xs" role="img" aria-label={`${resumo.percentualDirecionadas}% enviadas a clientes incluindo Várias, ${resumo.percentualInternas}% encaminhadas ao time interno e ${resumo.percentualArquivadas}% arquivadas; ${numero(resumo.classificadas)} classificadas`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dadosRosca} dataKey="quantidade" nameKey="nome" cx="50%" cy="50%" innerRadius={70} outerRadius={98} paddingAngle={dadosRosca.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
                    {dadosRosca.map(item => <Cell key={item.nome} fill={item.cor} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as (typeof dadosRosca)[number];
                    return <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg"><strong>{item.nome}</strong><p className="mt-1">{numero(item.quantidade)} · {item.percentual}% das classificadas</p></div>;
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true"><strong className="text-3xl tabular-nums text-slate-950">{numero(resumo.classificadas)}</strong><span className="text-xs text-muted-foreground">classificadas</span></div>
            </div>}
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-3 text-sm"><div className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: CORES.direcionadas }} /><Send className="h-4 w-4 text-teal-800" aria-hidden="true" /><span>Enviadas a clientes</span></div><strong className="tabular-nums">{numero(resumo.direcionadas)} · {resumo.classificadas ? `${resumo.percentualDirecionadas}%` : "—"}</strong></div>
            <p className="pl-5 text-xs text-muted-foreground">{numero(resumo.varias)} em Várias (já incluídas acima)</p>
            <div className="flex items-center justify-between gap-3 text-sm"><div className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: CORES.internas }} /><UsersRound className="h-4 w-4 text-indigo-700" aria-hidden="true" /><span>Time interno</span></div><strong className="tabular-nums">{numero(resumo.internas)} · {resumo.classificadas ? `${resumo.percentualInternas}%` : "—"}</strong></div>
            <div className="flex items-center justify-between gap-3 text-sm"><div className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: CORES.arquivadas }} /><Archive className="h-4 w-4 text-amber-700" aria-hidden="true" /><span>Arquivadas</span></div><strong className="tabular-nums">{numero(resumo.arquivadas)} · {resumo.classificadas ? `${resumo.percentualArquivadas}%` : "—"}</strong></div>
            <p className="pl-5 text-xs text-muted-foreground">{numero(resumo.arquivadasSemAcao)} sem encaminhamento · {numero(resumo.arquivadasInativos)} de clientes inativos</p>
          </div>
        </CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-5 sm:p-6">
          <h3 className="font-semibold">Proporção por categoria</h3>
          <p className="mt-1 text-xs text-muted-foreground">Cada barra representa 100% das classificadas naquela categoria.</p>
          {carregando ? <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">Carregando categorias...</div> : dadosCategorias.length === 0 ?
            <div className="flex h-60 items-center justify-center px-5 text-center text-sm text-muted-foreground">As categorias aparecerão aqui após a primeira destinação.</div> :
            <div className={modoRelatorio ? "overflow-visible" : "max-h-[380px] overflow-y-auto"} role="img" aria-label={`Comparação por categoria para ${dadosCategorias.length} categoria(s) com mensagens classificadas`}>
              <div style={{ height: Math.max(230, dadosCategorias.length * 51 + 44) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={dadosCategorias} margin={{ top: 12, right: 16, left: 0, bottom: 2 }} barSize={23}>
                    <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="categoria" width={115} tickFormatter={value => value.length > 17 ? `${value.slice(0, 16)}…` : value} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "#f8fafc" }} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as (typeof dadosCategorias)[number];
                      return <div className="max-w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg"><strong className="break-words">{item.categoria}</strong><p className="mt-1 text-teal-800">Clientes: {numero(item.direcionadas)} ({item.percentualDirecionadas}%) · {numero(item.varias)} em Várias</p><p className="text-indigo-700">Time interno: {numero(item.internas)} ({item.percentualInternas}%)</p><p className="text-amber-700">Arquivadas: {numero(item.arquivadas)} ({item.percentualArquivadas}%)</p><p className="mt-1 text-muted-foreground">{numero(item.pendentes)} ainda pendentes</p></div>;
                    }} />
                    <Bar dataKey="percentualDirecionadas" stackId="destino" fill={CORES.direcionadas} isAnimationActive={false} />
                    <Bar dataKey="percentualInternas" stackId="destino" fill={CORES.internas} isAnimationActive={false} />
                    <Bar dataKey="percentualArquivadas" stackId="destino" fill={CORES.arquivadas} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CORES.direcionadas }} /> Clientes (inclui Várias)</span><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CORES.internas }} /> Time interno</span><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CORES.arquivadas }} /> Arquivadas</span></div>
          {resumo.categorias.length > dadosCategorias.length && <p className="mt-2 text-xs text-muted-foreground">Categorias sem mensagens classificadas não aparecem nas barras.</p>}
        </CardContent></Card>
      </div>
    </section>
  );
}
