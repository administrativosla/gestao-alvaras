import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Pencil, Plus, Route, Tags } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

const COMPORTAMENTOS = {
  redirecionada_ativo: { nome: "Direcionar para cliente ativo", descricao: "Exige a seleção de um cliente ativo no lançamento." },
  redirecionada_varias: { nome: "Envio em grupo", descricao: "Sem vínculo individual com cliente; conta como envio a clientes." },
  encaminhada_time_interno: { nome: "Encaminhar ao time interno", descricao: "Sem vínculo com cliente; use observação para setor ou responsável." },
  arquivada_sem_acao: { nome: "Arquivar sem encaminhamento", descricao: "Encerra a mensagem sem direcioná-la." },
  arquivada_inativo: { nome: "Arquivar cliente inativo", descricao: "Permite vínculo opcional com cliente inativo." },
} as const;
type TipoBase = keyof typeof COMPORTAMENTOS;

export default function DecCategorias() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const podeGerenciar = user?.role === "gestor" || user?.role === "master";
  const utils = trpc.useUtils();
  const { data: categorias = [], isLoading: carregandoCategorias, error: erroCategorias } = trpc.dec.categorias.useQuery();
  const { data: direcionamentos = [], isLoading: carregandoDirecionamentos, error: erroDirecionamentos } = trpc.dec.direcionamentos.useQuery();
  const [categoriaOpen, setCategoriaOpen] = useState(false);
  const [categoriaId, setCategoriaId] = useState<number | undefined>();
  const [nomeCategoria, setNomeCategoria] = useState("");
  const [descricaoCategoria, setDescricaoCategoria] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState(true);
  const [direcionamentoOpen, setDirecionamentoOpen] = useState(false);
  const [direcionamentoId, setDirecionamentoId] = useState<number | undefined>();
  const [nomeDirecionamento, setNomeDirecionamento] = useState("");
  const [descricaoDirecionamento, setDescricaoDirecionamento] = useState("");
  const [tipoBase, setTipoBase] = useState<TipoBase>("redirecionada_ativo");
  const [direcionamentoAtivo, setDirecionamentoAtivo] = useState(true);
  const salvarCategoria = trpc.dec.salvarCategoria.useMutation({
    onSuccess: () => { toast.success(categoriaId ? "Categoria atualizada." : "Categoria cadastrada."); setCategoriaOpen(false); void utils.dec.categorias.invalidate(); },
    onError: erro => toast.error(erro.message),
  });
  const salvarDirecionamento = trpc.dec.salvarDirecionamento.useMutation({
    onSuccess: () => { toast.success(direcionamentoId ? "Direcionamento atualizado." : "Direcionamento cadastrado."); setDirecionamentoOpen(false); void utils.dec.direcionamentos.invalidate(); },
    onError: erro => toast.error(erro.message),
  });
  const editarCategoria = (categoria?: typeof categorias[number]) => {
    setCategoriaId(categoria?.id); setNomeCategoria(categoria?.nome ?? ""); setDescricaoCategoria(categoria?.descricao ?? ""); setCategoriaAtiva(categoria?.ativa ?? true); setCategoriaOpen(true);
  };
  const editarDirecionamento = (direcionamento?: typeof direcionamentos[number]) => {
    setDirecionamentoId(direcionamento?.id); setNomeDirecionamento(direcionamento?.nome ?? ""); setDescricaoDirecionamento(direcionamento?.descricao ?? ""); setTipoBase((direcionamento?.tipoBase ?? "redirecionada_ativo") as TipoBase); setDirecionamentoAtivo(direcionamento?.ativa ?? true); setDirecionamentoOpen(true);
  };

  return <div className="mx-auto max-w-6xl space-y-7 pb-10">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><Button variant="ghost" className="mb-2 -ml-3 gap-2 text-muted-foreground" onClick={() => navigate("/dec")}><ArrowLeft className="h-4 w-4" /> Painel DEC</Button>
        <h1 className="text-3xl font-semibold tracking-tight">Categorias e direcionamentos</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Organize os recebimentos e mantenha os destinos de classificação adaptados às demandas da operação.</p></div>
      {podeGerenciar && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => editarDirecionamento()} className="gap-2"><Plus className="h-4 w-4" /> Novo direcionamento</Button><Button onClick={() => editarCategoria()} className="gap-2"><Plus className="h-4 w-4" /> Nova categoria</Button></div>}
    </div>
    <div className="grid gap-6 md:grid-cols-2">
      <Card><CardContent className="p-0"><div className="flex items-start justify-between gap-3 border-b px-5 py-4"><div><div className="flex items-center gap-2"><Tags className="h-5 w-5 text-teal-700" /><h2 className="font-semibold">Categorias de mensagens</h2></div><p className="mt-1 text-xs text-muted-foreground">Classificam a natureza de cada recebimento.</p></div><Badge variant="secondary">{categorias.filter(c => c.ativa).length} ativas</Badge></div>
        {carregandoCategorias ? <p className="p-6 text-sm text-muted-foreground">Carregando categorias...</p> : erroCategorias ? <p className="p-6 text-sm text-destructive">Não foi possível carregar as categorias: {erroCategorias.message}</p> : categorias.length === 0 ?
          <div className="flex flex-col items-center gap-3 py-14 text-center"><Tags className="h-9 w-9 text-teal-700" /><h3 className="font-semibold">Ainda não há categorias</h3><p className="max-w-sm text-sm text-muted-foreground">{podeGerenciar ? "Ex.: intimação, aviso ou comunicado." : "Solicite a um gestor que cadastre as categorias."}</p>{podeGerenciar && <Button onClick={() => editarCategoria()}>Criar categoria</Button>}</div> :
          <div className="divide-y">{categorias.map(categoria => <div key={categoria.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><div className="flex items-center gap-2"><span className="font-medium">{categoria.nome}</span><Badge variant={categoria.ativa ? "secondary" : "outline"}>{categoria.ativa ? "Ativa" : "Desativada"}</Badge></div>{categoria.descricao && <p className="mt-1 text-sm text-muted-foreground">{categoria.descricao}</p>}</div>{podeGerenciar && <Button size="sm" variant="outline" onClick={() => editarCategoria(categoria)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</Button>}</div>)}</div>}
      </CardContent></Card>
      <Card className="border-violet-200"><CardContent className="p-0"><div className="flex items-start justify-between gap-3 border-b border-violet-100 bg-violet-50/60 px-5 py-4"><div><div className="flex items-center gap-2"><Route className="h-5 w-5 text-violet-700" /><h2 className="font-semibold">Direcionamentos</h2></div><p className="mt-1 text-xs text-muted-foreground">Definem os destinos disponíveis ao classificar mensagens.</p></div><Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">{direcionamentos.filter(d => d.ativa).length} ativos</Badge></div>
        {carregandoDirecionamentos ? <p className="p-6 text-sm text-muted-foreground">Carregando direcionamentos...</p> : erroDirecionamentos ? <p className="p-6 text-sm text-destructive">Não foi possível carregar os direcionamentos: {erroDirecionamentos.message}</p> : direcionamentos.length === 0 ?
          <div className="flex flex-col items-center gap-3 py-14 text-center"><Route className="h-9 w-9 text-violet-700" /><h3 className="font-semibold">Nenhum direcionamento cadastrado</h3><p className="max-w-sm text-sm text-muted-foreground">{podeGerenciar ? "Cadastre os destinos que devem aparecer no lançamento de mensagens." : "Solicite a um gestor que cadastre os direcionamentos."}</p>{podeGerenciar && <Button onClick={() => editarDirecionamento()}>Criar direcionamento</Button>}</div> :
          <div className="divide-y">{direcionamentos.map(direcionamento => <div key={direcionamento.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{direcionamento.nome}</span><Badge variant={direcionamento.ativa ? "secondary" : "outline"}>{direcionamento.ativa ? "Ativo" : "Desativado"}</Badge></div><p className="mt-1 text-xs font-medium text-violet-800">{COMPORTAMENTOS[direcionamento.tipoBase as TipoBase]?.nome}</p>{direcionamento.descricao && <p className="mt-1 text-sm text-muted-foreground">{direcionamento.descricao}</p>}</div>{podeGerenciar && <Button size="sm" variant="outline" onClick={() => editarDirecionamento(direcionamento)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</Button>}</div>)}</div>}
        <div className="border-t border-violet-100 bg-violet-50/40 px-5 py-3 text-xs text-violet-950">Desativar um direcionamento remove-o de novos lançamentos, mas preserva o nome e os indicadores nos registros anteriores.</div>
      </CardContent></Card>
    </div>
    <Dialog open={categoriaOpen} onOpenChange={setCategoriaOpen}><DialogContent><DialogHeader><DialogTitle>{categoriaId ? "Editar categoria" : "Nova categoria"}</DialogTitle><DialogDescription>As categorias desativadas deixam de aceitar novos lançamentos, mas continuam nos relatórios.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={evento => { evento.preventDefault(); salvarCategoria.mutate({ id: categoriaId, nome: nomeCategoria, descricao: descricaoCategoria || null, ativa: categoriaAtiva }); }}>
        <div className="space-y-2"><Label htmlFor="dec-categoria-nome">Nome da categoria</Label><Input id="dec-categoria-nome" required minLength={2} maxLength={120} value={nomeCategoria} onChange={evento => setNomeCategoria(evento.target.value)} placeholder="Ex.: Intimação" /></div>
        <div className="space-y-2"><Label htmlFor="dec-categoria-desc">Descrição opcional</Label><Input id="dec-categoria-desc" maxLength={500} value={descricaoCategoria} onChange={evento => setDescricaoCategoria(evento.target.value)} placeholder="Quando utilizar esta categoria" /></div>
        {categoriaId && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categoriaAtiva} onChange={evento => setCategoriaAtiva(evento.target.checked)} /> Categoria ativa</label>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCategoriaOpen(false)}>Cancelar</Button><Button disabled={salvarCategoria.isPending} type="submit">{salvarCategoria.isPending ? "Salvando..." : "Salvar categoria"}</Button></div>
      </form>
    </DialogContent></Dialog>
    <Dialog open={direcionamentoOpen} onOpenChange={setDirecionamentoOpen}><DialogContent><DialogHeader><DialogTitle>{direcionamentoId ? "Editar direcionamento" : "Novo direcionamento"}</DialogTitle><DialogDescription>O comportamento operacional define quando o lançamento exige ou dispensa vínculo com cliente e como ele entra nos indicadores.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={evento => { evento.preventDefault(); salvarDirecionamento.mutate({ id: direcionamentoId, nome: nomeDirecionamento, descricao: descricaoDirecionamento || null, tipoBase, ativa: direcionamentoAtivo }); }}>
        <div className="space-y-2"><Label htmlFor="dec-direcionamento-nome">Nome exibido</Label><Input id="dec-direcionamento-nome" required minLength={2} maxLength={120} value={nomeDirecionamento} onChange={evento => setNomeDirecionamento(evento.target.value)} placeholder="Ex.: Enviado para assinatura digital" /></div>
        <div className="space-y-2"><Label htmlFor="dec-direcionamento-tipo">Comportamento operacional</Label><Select value={tipoBase} onValueChange={valor => setTipoBase(valor as TipoBase)}><SelectTrigger id="dec-direcionamento-tipo"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(COMPORTAMENTOS).map(([tipo, configuracao]) => <SelectItem key={tipo} value={tipo}>{configuracao.nome}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{COMPORTAMENTOS[tipoBase].descricao}</p></div>
        <div className="space-y-2"><Label htmlFor="dec-direcionamento-desc">Descrição opcional</Label><Input id="dec-direcionamento-desc" maxLength={500} value={descricaoDirecionamento} onChange={evento => setDescricaoDirecionamento(evento.target.value)} placeholder="Quando este direcionamento deve ser utilizado" /></div>
        {direcionamentoId && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={direcionamentoAtivo} onChange={evento => setDirecionamentoAtivo(evento.target.checked)} /> Direcionamento ativo</label>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDirecionamentoOpen(false)}>Cancelar</Button><Button disabled={salvarDirecionamento.isPending} type="submit">{salvarDirecionamento.isPending ? "Salvando..." : "Salvar direcionamento"}</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>;
}
