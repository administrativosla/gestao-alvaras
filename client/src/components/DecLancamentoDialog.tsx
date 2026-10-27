import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DecDestinacaoCampos, destinoVazioDec, type DestinacaoFormDec } from "@/components/DecDestinacaoCampos";
import { diaLocal } from "@/lib/decFormat";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type LinhaData = { id: number; dia: string; quantidade: string; observacao: string };
type ResultadoSalvo = { classificadas: number; pendentes: number; dias: string[] };

export default function DecLancamentoDialog({ open, onOpenChange, categorias, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: { id: number; nome: string; ativa: boolean }[];
  onSaved: (resultado: ResultadoSalvo) => void;
}) {
  const [categoriaId, setCategoriaId] = useState("");
  const [dia, setDia] = useState(() => diaLocal());
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [destinacoes, setDestinacoes] = useState<DestinacaoFormDec[]>([]);
  const [multiplasDatas, setMultiplasDatas] = useState(false);
  const [linhasDatas, setLinhasDatas] = useState<LinhaData[]>([]);
  const criar = trpc.dec.criarRecebimento.useMutation({ onError: erro => toast.error(erro.message) });
  const criarMultiplos = trpc.dec.criarRecebimentosMultiplos.useMutation({ onError: erro => toast.error(erro.message) });
  const { data: coincidentes = [] } = trpc.dec.listar.useQuery({ inicio: dia, fim: dia, categoriaId: Number(categoriaId) || undefined }, { enabled: !multiplasDatas && !!categoriaId && /^\d{4}-\d{2}-\d{2}$/.test(dia) });
  const total = Number(quantidade) || 0;
  const classificadas = destinacoes.reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0);
  const pendentes = Math.max(0, total - classificadas);
  const invadido = classificadas > total;
  const totalDistribuido = linhasDatas.reduce((soma, linha) => soma + (Number(linha.quantidade) || 0), 0);
  const datasDuplicadas = new Set<string>();
  const temDataDuplicada = linhasDatas.some(linha => !linha.dia || (datasDuplicadas.has(linha.dia) ? true : (datasDuplicadas.add(linha.dia), false)));
  const alterarModoMultiplas = (ativar: boolean) => {
    if (ativar && linhasDatas.length < 2) setLinhasDatas([{ id: 1, dia, quantidade: "" , observacao: "" }, { id: 2, dia: "", quantidade: "", observacao: "" }]);
    setMultiplasDatas(ativar);
  };
  const adicionarData = () => setLinhasDatas(linhas => [...linhas, { id: Date.now(), dia: "", quantidade: "", observacao: "" }]);
  const atualizarData = (id: number, campo: keyof Omit<LinhaData, "id">, valor: string) => setLinhasDatas(linhas => linhas.map(linha => linha.id === id ? { ...linha, [campo]: valor } : linha));

  const salvar = (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoriaId || !Number.isInteger(total) || total < 1) return toast.error("Selecione a categoria e informe um total válido.");
    if (multiplasDatas) {
      if (linhasDatas.length < 2) return toast.error("Informe pelo menos duas datas para este modo de lançamento.");
      if (linhasDatas.some(linha => !/^\d{4}-\d{2}-\d{2}$/.test(linha.dia) || !Number.isInteger(Number(linha.quantidade)) || Number(linha.quantidade) < 1)) return toast.error("Informe uma data e uma quantidade inteira positiva em cada linha.");
      if (temDataDuplicada) return toast.error("Cada data deve aparecer apenas uma vez.");
      if (totalDistribuido !== total) return toast.error("A soma das quantidades por data deve ser igual ao volume total informado.");
      criarMultiplos.mutate({ categoriaId: Number(categoriaId), quantidadeTotal: total, recebimentos: linhasDatas.map(linha => ({ dia: linha.dia, quantidade: Number(linha.quantidade), observacao: linha.observacao || null })) }, {
        onSuccess: () => { onSaved({ classificadas: 0, pendentes: total, dias: linhasDatas.map(linha => linha.dia) }); onOpenChange(false); },
      });
      return;
    }
    if (invadido) return toast.error("A soma das destinações não pode superar o total recebido.");
    if (destinacoes.some(item => !item.direcionamentoId || !Number.isInteger(Number(item.quantidade)) || Number(item.quantidade) < 1)) return toast.error("Selecione o direcionamento e informe a quantidade em cada destinação.");
    if (destinacoes.some(item => item.tipo === "redirecionada_ativo" && !item.clienteId)) return toast.error("Selecione o cliente ativo nas mensagens direcionadas.");
    criar.mutate({ categoriaId: Number(categoriaId), dia, quantidade: total, observacao: observacao || null,
      destinacoes: destinacoes.map(item => ({ direcionamentoId: item.direcionamentoId ?? undefined, tipo: item.tipo, quantidade: Number(item.quantidade), clienteId: item.clienteId, observacao: item.observacao || null })),
    }, { onSuccess: () => { onSaved({ classificadas, pendentes, dias: [dia] }); onOpenChange(false); } });
  };
  const salvando = criar.isPending || criarMultiplos.isPending;

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
    <DialogHeader><DialogTitle>{multiplasDatas ? "Lançar volume em várias datas" : "Lançar mensagens recebidas"}</DialogTitle><DialogDescription>{multiplasDatas ? "Distribua o total entre as datas selecionadas. Cada linha virará um recebimento separado, pronto para classificação posterior no histórico." : "Registre o total por categoria e, se já souber o destino, classifique aqui mesmo. O restante pode ser tratado depois no histórico."}</DialogDescription></DialogHeader>
    <form onSubmit={salvar} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label>Categoria da mensagem</Label><Select value={categoriaId} onValueChange={setCategoriaId}><SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger><SelectContent>{categorias.filter(categoria => categoria.ativa).map(categoria => <SelectItem key={categoria.id} value={String(categoria.id)}>{categoria.nome}</SelectItem>)}</SelectContent></Select>{!categorias.some(categoria => categoria.ativa) && <p className="text-xs text-amber-700">Cadastre primeiro uma categoria ativa na seção Categorias.</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="dec-lancamento-total">{multiplasDatas ? "Volume total de mensagens" : "Mensagens recebidas"}</Label><Input id="dec-lancamento-total" type="number" inputMode="numeric" min={1} max={1000000} step={1} required value={quantidade} onChange={event => setQuantidade(event.target.value)} /></div>
        {!multiplasDatas && <div className="space-y-1.5"><Label htmlFor="dec-lancamento-dia">Data do recebimento</Label><Input id="dec-lancamento-dia" type="date" required value={dia} onChange={event => setDia(event.target.value)} /></div>}
        {!multiplasDatas && coincidentes.length > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 sm:col-span-2">Já existe {coincidentes.length} lançamento(s) nessa categoria e data. Este total será adicional; não substituirá os anteriores.</p>}
        {!multiplasDatas && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dec-lancamento-obs">Observação do lote (opcional)</Label><Input id="dec-lancamento-obs" value={observacao} onChange={event => setObservacao(event.target.value)} maxLength={1000} /></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3"><div><p className="text-sm font-medium text-violet-950">Lançar em várias datas</p><p className="text-xs text-violet-900">Use para distribuir um mesmo volume da categoria entre diferentes dias.</p></div><Button type="button" size="sm" variant={multiplasDatas ? "default" : "outline"} className={multiplasDatas ? "bg-violet-700 hover:bg-violet-800" : "gap-1"} onClick={() => alterarModoMultiplas(!multiplasDatas)}>{!multiplasDatas && <CalendarDays className="h-4 w-4" />}{multiplasDatas ? "Usar data única" : "Selecionar várias datas"}</Button></div>
      {multiplasDatas ? <div className="space-y-3 border-t pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Distribuição por data</h3><p className="text-xs text-muted-foreground">As destinações serão informadas posteriormente no Histórico, em cada recebimento.</p></div><Button type="button" size="sm" variant="outline" onClick={adicionarData} disabled={linhasDatas.length >= 100} className="gap-1"><Plus className="h-4 w-4" /> Adicionar data</Button></div>
        <div className="space-y-2">{linhasDatas.map((linha, indice) => <div key={linha.id} className="grid gap-2 rounded-lg border bg-slate-50/70 p-3 sm:grid-cols-[1fr_130px_1.3fr_auto]"><div><Label className="text-xs" htmlFor={`dec-multi-dia-${linha.id}`}>Data {indice + 1}</Label><Input id={`dec-multi-dia-${linha.id}`} type="date" required value={linha.dia} onChange={event => atualizarData(linha.id, "dia", event.target.value)} /></div><div><Label className="text-xs" htmlFor={`dec-multi-qtd-${linha.id}`}>Quantidade</Label><Input id={`dec-multi-qtd-${linha.id}`} type="number" min={1} max={total || 1000000} step={1} required value={linha.quantidade} onChange={event => atualizarData(linha.id, "quantidade", event.target.value)} /></div><div><Label className="text-xs" htmlFor={`dec-multi-obs-${linha.id}`}>Observação (opcional)</Label><Input id={`dec-multi-obs-${linha.id}`} maxLength={1000} value={linha.observacao} onChange={event => atualizarData(linha.id, "observacao", event.target.value)} /></div><Button type="button" size="icon" variant="ghost" className="self-end" aria-label={`Remover data ${indice + 1}`} disabled={linhasDatas.length <= 2} onClick={() => setLinhasDatas(linhas => linhas.filter(item => item.id !== linha.id))}><Trash2 className="h-4 w-4 text-slate-500" /></Button></div>)}</div>
        <div className={`flex flex-wrap justify-between gap-2 rounded-lg p-3 text-sm ${totalDistribuido === total && total > 0 && !temDataDuplicada ? "border border-teal-200 bg-teal-50 text-teal-900" : "border border-amber-200 bg-amber-50 text-amber-900"}`}><span>Distribuído nas datas: <strong>{totalDistribuido}</strong></span><span>Volume total informado: <strong>{total}</strong></span>{temDataDuplicada && <strong>Há datas repetidas.</strong>}{!temDataDuplicada && totalDistribuido !== total && <strong>Faltam ou sobram {Math.abs(total - totalDistribuido)} mensagem(ns).</strong>}</div>
      </div> : <div className="space-y-3 border-t pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Classificação no lançamento <span className="text-xs font-normal text-muted-foreground">(opcional)</span></h3><p className="text-xs text-muted-foreground">É possível repartir o total entre clientes, time interno e arquivos.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setDestinacoes(items => [...items, destinoVazioDec()])} disabled={destinacoes.length >= 100} className="gap-1"><Plus className="h-4 w-4" /> Adicionar destinação</Button></div>
        {destinacoes.map((item, index) => <div key={index} className="rounded-lg border bg-slate-50/70 p-3 sm:p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-sm">Destinação {index + 1}</strong><Button type="button" size="sm" variant="ghost" aria-label={`Remover destinação ${index + 1}`} onClick={() => setDestinacoes(items => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4 text-slate-500" /></Button></div><DecDestinacaoCampos prefix={`dec-nova-${index}`} value={item} onChange={novo => setDestinacoes(items => items.map((atual, itemIndex) => itemIndex === index ? novo : atual))} max={total || 1000000} /></div>)}
        {!destinacoes.length && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nenhuma destinação preenchida. Se salvar assim, todas as mensagens ficarão a classificar.</p>}
        <div className={`flex flex-wrap justify-between gap-2 rounded-lg p-3 text-sm ${invadido ? "border border-red-200 bg-red-50 text-red-800" : "border border-teal-200 bg-teal-50 text-teal-900"}`}><span>Classificadas agora: <strong>{classificadas}</strong></span><span>A classificar depois: <strong>{pendentes}</strong></span>{invadido && <strong>Destinações acima do total recebido.</strong>}</div>
      </div>}
      <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={salvando || !categoriaId || (!multiplasDatas && invadido) || (multiplasDatas && (linhasDatas.length < 2 || temDataDuplicada || totalDistribuido !== total))}>{salvando ? "Salvando..." : multiplasDatas ? "Registrar recebimentos" : "Registrar recebimento"}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
