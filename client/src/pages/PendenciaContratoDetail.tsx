import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, CalendarClock, CheckCircle2, Clock3, FileText, History, Loader2, Pencil, UserRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { usePermissoes } from "@/hooks/usePermissoes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Status = "sem_contato" | "cliente_contatado" | "contato_sem_retorno" | "fase_ajustes" | "aprovacao_minuta" | "links_enviados" | "assinado_parcial" | "assinado_total";
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
const TIPOS: Record<string, string> = { prestacao_servico: "Contrato de prestação de serviço", coworking: "Contrato de coworking" };
const STATUS_LIST = Object.keys(STATUS) as Status[];
function cnpj(valor: string) { const d = valor.replace(/\D/g, ""); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : valor; }
function dataHora(valor?: string | Date | null) { return valor ? new Date(valor).toLocaleString("pt-BR") : "—"; }
function badge(status: string) { const config = STATUS[status as Status] ?? { label: status, className: "border-slate-200 bg-slate-100 text-slate-700" }; return <Badge variant="outline" className={config.className}>{config.label}</Badge>; }

export default function PendenciaContratoDetail({ id }: { id: number }) {
  const [, navegar] = useLocation();
  const utils = trpc.useUtils();
  const { pode } = usePermissoes();
  const { data, isLoading, error } = trpc.pendenciasContrato.get.useQuery({ id });
  const [editando, setEditando] = useState(false);
  const [novoStatus, setNovoStatus] = useState<Status | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const atualizar = trpc.pendenciasContrato.atualizarStatus.useMutation({
    onSuccess: (resultado) => { toast.success(resultado.retornoAte ? "Status atualizado. O prazo de 48 horas foi registrado." : "Status e justificativa registrados."); setEditando(false); setJustificativa(""); void utils.pendenciasContrato.invalidate(); },
    onError: (erro) => toast.error(erro.message),
  });
  if (isLoading) return <div className="mx-auto max-w-6xl space-y-4 py-4"><div className="h-7 w-48 animate-pulse rounded bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" /></div>;
  if (error || !data) return <div className="mx-auto max-w-3xl py-16 text-center"><h1 className="text-xl font-semibold">Pendência não encontrada</h1><p className="mt-2 text-sm text-muted-foreground">{error?.message ?? "O registro solicitado não está disponível."}</p><Button className="mt-5" onClick={() => navegar("/pendencias-contrato/lista")}>Voltar para a lista</Button></div>;
  const { pendencia, cliente, historico } = data as any;
  const statusSelecionado = novoStatus ?? pendencia.status as Status;
  const podeEditar = pode("pendencias_contrato", "atualizar_status");

  return <div className="mx-auto max-w-6xl space-y-6 pb-10"><Button variant="ghost" size="sm" className="gap-1 px-0" onClick={() => navegar("/pendencias-contrato/lista")}><ArrowLeft className="h-4 w-4" /> Voltar para pendências</Button>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.17em] text-violet-700">{TIPOS[pendencia.tipo]}</p>{badge(pendencia.status)}</div><h1 className="mt-2 text-3xl font-semibold tracking-tight">{cliente.razaoSocial}</h1><p className="mt-1 font-mono text-sm text-muted-foreground">{cnpj(cliente.cnpj)}</p></div>{podeEditar && <Button onClick={() => { setNovoStatus(pendencia.status); setEditando(true); }} className="gap-2"><Pencil className="h-4 w-4" /> Atualizar status</Button>}</div>
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><div className="space-y-5"><Card><CardHeader><CardTitle className="text-base">Dados da pendência</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Info icon={FileText} label="Tipo" value={TIPOS[pendencia.tipo]} /><Info icon={CalendarClock} label="Última atualização" value={dataHora(pendencia.updatedAt)} /><Info icon={Clock3} label="Contato registrado em" value={dataHora(pendencia.contatadoEm)} /><Info icon={Clock3} label="Prazo de retorno" value={dataHora(pendencia.retornoAte)} /><div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Descrição de origem</p><p className="mt-1 text-sm">{pendencia.descricaoOrigem ?? "Não informada"}</p></div>{pendencia.arquivoOrigem && <p className="sm:col-span-2 text-xs text-muted-foreground">Origem: {pendencia.arquivoOrigem}{pendencia.linhaOrigem ? ` · linha ${pendencia.linhaOrigem}` : ""}</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-violet-700" /> Histórico de abordagens</CardTitle><CardDescription>Todos os eventos são preservados, inclusive transições automáticas.</CardDescription></CardHeader><CardContent className="space-y-4">{historico.map((evento: any) => <div key={evento.id} className="relative border-l-2 border-violet-200 pl-4"><div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-violet-500" /><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{evento.statusAnterior ? `${STATUS[evento.statusAnterior as Status]?.label ?? evento.statusAnterior} → ` : ""}{STATUS[evento.statusNovo as Status]?.label ?? evento.statusNovo}</span><Badge variant="secondary" className="text-[10px]">{evento.tipoEvento === "automatico" ? "Automático" : evento.tipoEvento === "importacao" ? "Importação" : "Manual"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{evento.usuarioNome ?? "Sistema"} · {dataHora(evento.createdAt)}</p>{evento.justificativa && <p className="mt-2 text-sm text-muted-foreground">{evento.justificativa}</p>}</div>)}{!historico.length && <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>}</CardContent></Card>
      </div><div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-violet-700" /> Cliente compartilhado</CardTitle><CardDescription>Este cadastro é o mesmo utilizado pelos gestores de Alvarás e DEC.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><Info icon={UserRound} label="Contato" value={cliente.nomeContato ?? "Não informado"} /><Info icon={UserRound} label="Telefone" value={cliente.telefone ?? "Não informado"} /><Info icon={UserRound} label="E-mail" value={cliente.email ?? "Não informado"} /><Button variant="outline" className="mt-2 w-full" onClick={() => navegar(`/pendencias-contrato/clientes/${cliente.id}`)}>Abrir ficha do cliente</Button></CardContent></Card>{pendencia.status === "cliente_contatado" && pendencia.retornoAte && <Card className="border-blue-200 bg-blue-50/50"><CardContent className="p-5"><p className="font-semibold text-blue-900">Acompanhamento de 48 horas</p><p className="mt-1 text-sm text-blue-900/80">Caso não haja nova atualização até {dataHora(pendencia.retornoAte)}, o sistema moverá esta pendência automaticamente para “Contato sem retorno”.</p></CardContent></Card>}</div></div>
    {editando && <Card className="border-violet-200"><CardHeader><CardTitle className="text-base">Registrar nova etapa</CardTitle><CardDescription>A justificativa é obrigatória. Ao selecionar “Cliente contatado”, o prazo automático de 48 horas será iniciado.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Novo status</Label><Select value={statusSelecionado} onValueChange={(valor) => setNovoStatus(valor as Status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_LIST.map((status) => <SelectItem key={status} value={status}>{STATUS[status].label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 md:col-span-2"><Label>Justificativa</Label><Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Descreva o que aconteceu nesta abordagem..." maxLength={3000} /></div><div className="flex justify-end gap-2 md:col-span-2"><Button variant="outline" onClick={() => setEditando(false)}>Cancelar</Button><Button disabled={atualizar.isPending || justificativa.trim().length < 3 || statusSelecionado === pendencia.status} onClick={() => atualizar.mutate({ id: pendencia.id, status: statusSelecionado, justificativa })}>{atualizar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar no histórico</Button></div></CardContent></Card>}
  </div>;
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) { return <div><p className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>; }
