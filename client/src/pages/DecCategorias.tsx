import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Pencil, Plus, Tags } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function DecCategorias() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const podeGerenciar = user?.role === "gestor" || user?.role === "master";
  const utils = trpc.useUtils();
  const { data: categorias = [], isLoading, error } = trpc.dec.categorias.useQuery();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState<number | undefined>();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativa, setAtiva] = useState(true);
  const salvar = trpc.dec.salvarCategoria.useMutation({
    onSuccess: () => { toast.success(id ? "Categoria atualizada." : "Categoria cadastrada."); setOpen(false); void utils.dec.categorias.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const editar = (categoria?: typeof categorias[number]) => {
    setId(categoria?.id); setNome(categoria?.nome ?? ""); setDescricao(categoria?.descricao ?? ""); setAtiva(categoria?.ativa ?? true); setOpen(true);
  };
  return <div className="mx-auto max-w-5xl space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><Button variant="ghost" className="mb-2 -ml-3 gap-2 text-muted-foreground" onClick={() => navigate("/dec")}><ArrowLeft className="h-4 w-4" /> Painel DEC</Button>
        <h1 className="text-3xl font-semibold tracking-tight">Categorias de mensagens</h1>
        <p className="mt-2 text-sm text-muted-foreground">Organize os recebimentos; desativar uma categoria preserva seus números históricos.</p></div>
      {podeGerenciar && <Button onClick={() => editar()} className="gap-2"><Plus className="h-4 w-4" /> Nova categoria</Button>}
    </div>
    <Card><CardContent className="p-0">
      {isLoading ? <p className="p-6 text-sm text-muted-foreground">Carregando categorias...</p> : error ? <p className="p-6 text-sm text-destructive">Não foi possível carregar as categorias: {error.message}</p> : categorias.length === 0 ?
        <div className="flex flex-col items-center gap-3 py-16 text-center"><Tags className="h-9 w-9 text-teal-700" /><h2 className="font-semibold">{podeGerenciar ? "Comece criando uma categoria" : "Ainda não há categorias"}</h2><p className="text-sm text-muted-foreground">{podeGerenciar ? "Ex.: intimação, aviso ou comunicado." : "Solicite a um gestor que cadastre as categorias."}</p>{podeGerenciar && <Button onClick={() => editar()}>Criar categoria</Button>}</div> :
        <div className="divide-y">{categorias.map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><div className="flex items-center gap-2"><span className="font-medium">{c.nome}</span><Badge variant={c.ativa ? "secondary" : "outline"}>{c.ativa ? "Ativa" : "Desativada"}</Badge></div>{c.descricao && <p className="mt-1 text-sm text-muted-foreground">{c.descricao}</p>}</div>{podeGerenciar && <Button size="sm" variant="outline" onClick={() => editar(c)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</Button>}</div>)}</div>}
    </CardContent></Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{id ? "Editar categoria" : "Nova categoria"}</DialogTitle><DialogDescription>As categorias desativadas deixam de aceitar novos lançamentos, mas continuam nos relatórios.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); salvar.mutate({ id, nome, descricao: descricao || null, ativa }); }}>
        <div className="space-y-2"><Label htmlFor="dec-categoria-nome">Nome da categoria</Label><Input id="dec-categoria-nome" required minLength={2} maxLength={120} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Intimação" /></div>
        <div className="space-y-2"><Label htmlFor="dec-categoria-desc">Descrição opcional</Label><Input id="dec-categoria-desc" maxLength={500} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Quando utilizar esta categoria" /></div>
        {id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativa} onChange={e => setAtiva(e.target.checked)} /> Categoria ativa</label>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={salvar.isPending} type="submit">{salvar.isPending ? "Salvando..." : "Salvar categoria"}</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>;
}
