import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DecDestinacaoCampos, destinoVazioDec, type DestinacaoFormDec } from "@/components/DecDestinacaoCampos";
import { diaLocal } from "@/lib/decFormat";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function DecLancamentoDialog({ open, onOpenChange, categorias, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: { id: number; nome: string; ativa: boolean }[];
  onSaved: (id: number, classificadas: number, pendentes: number, dia: string) => void;
}) {
  const [categoriaId, setCategoriaId] = useState("");
  const [dia, setDia] = useState(() => diaLocal());
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [destinacoes, setDestinacoes] = useState<DestinacaoFormDec[]>([]);
  const criar = trpc.dec.criarRecebimento.useMutation({ onError: erro => toast.error(erro.message) });
  const { data: coincidentes = [] } = trpc.dec.listar.useQuery({ inicio: dia, fim: dia, categoriaId: Number(categoriaId) || undefined }, { enabled: !!categoriaId && /^\d{4}-\d{2}-\d{2}$/.test(dia) });
  const total = Number(quantidade) || 0;
  const classificadas = destinacoes.reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0);
  const pendentes = Math.max(0, total - classificadas);
  const invadido = classificadas > total;

  const salvar = (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoriaId || !Number.isInteger(total) || total < 1) return toast.error("Selecione a categoria e informe um total válido.");
    if (invadido) return toast.error("A soma das destinações não pode superar o total recebido.");
    if (destinacoes.some(item => !Number.isInteger(Number(item.quantidade)) || Number(item.quantidade) < 1)) return toast.error("Informe a quantidade em cada destinação.");
    if (destinacoes.some(item => item.tipo === "redirecionada_ativo" && !item.clienteId)) return toast.error("Selecione o cliente ativo nas mensagens direcionadas.");
    criar.mutate({ categoriaId: Number(categoriaId), dia, quantidade: total, observacao: observacao || null,
      destinacoes: destinacoes.map(item => ({ tipo: item.tipo, quantidade: Number(item.quantidade), clienteId: item.clienteId, observacao: item.observacao || null })),
    }, { onSuccess: resultado => { onSaved(resultado.id, classificadas, pendentes, dia); onOpenChange(false); } });
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
    <DialogHeader><DialogTitle>Lançar mensagens recebidas</DialogTitle><DialogDescription>Registre o total por categoria e, se já souber o destino, classifique aqui mesmo. O restante pode ser tratado depois no histórico.</DialogDescription></DialogHeader>
    <form onSubmit={salvar} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label>Categoria da mensagem</Label><Select value={categoriaId} onValueChange={setCategoriaId}><SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger><SelectContent>{categorias.filter(c => c.ativa).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent></Select>{!categorias.some(c => c.ativa) && <p className="text-xs text-amber-700">Cadastre primeiro uma categoria ativa na seção Categorias.</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="dec-lancamento-dia">Data do recebimento</Label><Input id="dec-lancamento-dia" type="date" required value={dia} onChange={e => setDia(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="dec-lancamento-total">Mensagens recebidas</Label><Input id="dec-lancamento-total" type="number" inputMode="numeric" min={1} max={1000000} step={1} required value={quantidade} onChange={e => setQuantidade(e.target.value)} /></div>
        {coincidentes.length > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 sm:col-span-2">Já existe {coincidentes.length} lançamento(s) nessa categoria e data. Este total será adicional; não substituirá os anteriores.</p>}
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dec-lancamento-obs">Observação do lote (opcional)</Label><Input id="dec-lancamento-obs" value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={1000} /></div>
      </div>
      <div className="space-y-3 border-t pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Classificação no lançamento <span className="text-xs font-normal text-muted-foreground">(opcional)</span></h3><p className="text-xs text-muted-foreground">É possível repartir o total entre clientes, time interno e arquivos.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setDestinacoes(items => [...items, destinoVazioDec()])} disabled={destinacoes.length >= 100} className="gap-1"><Plus className="h-4 w-4" /> Adicionar destinação</Button></div>
        {destinacoes.map((item, index) => <div key={index} className="rounded-lg border bg-slate-50/70 p-3 sm:p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-sm">Destinação {index + 1}</strong><Button type="button" size="sm" variant="ghost" aria-label={`Remover destinação ${index + 1}`} onClick={() => setDestinacoes(items => items.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-slate-500" /></Button></div><DecDestinacaoCampos prefix={`dec-nova-${index}`} value={item} onChange={novo => setDestinacoes(items => items.map((atual, i) => i === index ? novo : atual))} max={total || 1000000} /></div>)}
        {!destinacoes.length && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nenhuma destinação preenchida. Se salvar assim, todas as mensagens ficarão a classificar.</p>}
        <div className={`flex flex-wrap justify-between gap-2 rounded-lg p-3 text-sm ${invadido ? "border border-red-200 bg-red-50 text-red-800" : "border border-teal-200 bg-teal-50 text-teal-900"}`}><span>Classificadas agora: <strong>{classificadas}</strong></span><span>A classificar depois: <strong>{pendentes}</strong></span>{invadido && <strong>Destinações acima do total recebido.</strong>}</div>
      </div>
      <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={criar.isPending || invadido || !categoriaId}>{criar.isPending ? "Salvando..." : "Registrar recebimento"}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
