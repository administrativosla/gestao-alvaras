import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type TipoDestinacaoDec } from "@shared/decTipos";

export type DestinacaoFormDec = {
  direcionamentoId: number | null;
  tipo: TipoDestinacaoDec;
  quantidade: string;
  clienteId: number | null;
  clienteNome: string;
  observacao: string;
};

export function destinoVazioDec(): DestinacaoFormDec {
  return { direcionamentoId: null, tipo: "redirecionada_ativo", quantidade: "", clienteId: null, clienteNome: "", observacao: "" };
}

export function DecDestinacaoCampos({ value, onChange, max, prefix }: {
  value: DestinacaoFormDec;
  onChange: (value: DestinacaoFormDec) => void;
  max: number;
  prefix: string;
}) {
  const { data: direcionamentos = [], isLoading: carregandoDirecionamentos } = trpc.dec.direcionamentos.useQuery({ somenteAtivos: true });
  const selecionado = direcionamentos.find(direcionamento => direcionamento.id === value.direcionamentoId);
  const tipoBase = selecionado?.tipoBase ?? value.tipo;
  const precisaCliente = tipoBase === "redirecionada_ativo" || tipoBase === "arquivada_inativo";
  const pesquisa = value.clienteNome.trim();
  const { data: clientes = [] } = trpc.dec.clientes.useQuery({ pesquisa }, { enabled: precisaCliente && !value.clienteId && pesquisa.length >= 2 });
  const encontrados = clientes.filter(cliente => tipoBase === "redirecionada_ativo" ? cliente.ativo : !cliente.ativo);
  const varios = direcionamentos.find(direcionamento => direcionamento.tipoBase === "redirecionada_varias");
  const selecionarDirecionamento = (id: string) => {
    const direcionamento = direcionamentos.find(item => item.id === Number(id));
    if (!direcionamento) return;
    onChange({ ...value, direcionamentoId: direcionamento.id, tipo: direcionamento.tipoBase as TipoDestinacaoDec, clienteId: null, clienteNome: "" });
  };

  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor={`${prefix}-direcionamento`}>Direcionamento</Label>
        <Select value={value.direcionamentoId ? String(value.direcionamentoId) : undefined} onValueChange={selecionarDirecionamento} disabled={carregandoDirecionamentos || !direcionamentos.length}>
          <SelectTrigger id={`${prefix}-direcionamento`}><SelectValue placeholder={carregandoDirecionamentos ? "Carregando..." : "Selecione um direcionamento"} /></SelectTrigger>
          <SelectContent>{direcionamentos.map(direcionamento => <SelectItem key={direcionamento.id} value={String(direcionamento.id)}>{direcionamento.nome}</SelectItem>)}</SelectContent>
        </Select>
        {!carregandoDirecionamentos && !direcionamentos.length && <p className="text-xs text-amber-700">Nenhum direcionamento ativo. Solicite o cadastro na aba Categorias.</p>}
        {selecionado?.descricao && <p className="text-xs text-muted-foreground">{selecionado.descricao}</p>}
      </div>
      <div className="space-y-1.5"><Label htmlFor={`${prefix}-quantidade`}>Quantidade destinada</Label><Input id={`${prefix}-quantidade`} type="number" inputMode="numeric" min={1} max={max} step={1} required value={value.quantidade} onChange={e => onChange({ ...value, quantidade: e.target.value })} /></div>
    </div>
    {precisaCliente && <div className="space-y-1.5"><Label htmlFor={`${prefix}-cliente`}>{tipoBase === "redirecionada_ativo" ? "Cliente ativo (obrigatório)" : "Cliente inativo (opcional)"}</Label>
      <Input id={`${prefix}-cliente`} value={value.clienteNome} onChange={e => onChange({ ...value, clienteNome: e.target.value, clienteId: null })} placeholder="Busque por razão social ou CNPJ" />
      {tipoBase === "redirecionada_ativo" && varios && <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => onChange({ ...value, direcionamentoId: varios.id, tipo: varios.tipoBase as TipoDestinacaoDec, clienteId: null, clienteNome: "" })}>Selecionar Várias empresas</Button>}
      {value.clienteId && <p className="text-xs text-teal-700">Cliente selecionado</p>}
      {tipoBase === "arquivada_inativo" && !value.clienteId && <p className="text-xs text-muted-foreground">Se o cliente inativo não estiver cadastrado, anote-o na observação.</p>}
      {pesquisa.length >= 2 && !value.clienteId && <div className="max-h-32 overflow-y-auto rounded-md border bg-background" role="listbox">{encontrados.map(cliente => <button type="button" role="option" aria-selected={false} key={cliente.id} onClick={() => onChange({ ...value, clienteId: cliente.id, clienteNome: `${cliente.razaoSocial} · ${cliente.cnpj}` })} className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50">{cliente.razaoSocial} · {cliente.cnpj}</button>)}{!encontrados.length && <p className="p-3 text-sm text-muted-foreground">Nenhum cliente com este status encontrado.</p>}</div>}
    </div>}
    {tipoBase === "encaminhada_time_interno" && <p className="rounded-md border border-indigo-200 bg-indigo-50 p-2 text-xs text-indigo-900">Sem vínculo a cliente; informe o setor ou responsável no campo abaixo, se desejar.</p>}
    {tipoBase === "redirecionada_varias" && <p className="rounded-md border border-teal-200 bg-teal-50 p-2 text-xs text-teal-900">Para comunicado enviado a várias empresas, sem vínculo individual com cliente. Cada unidade informada conta uma mensagem encaminhada em grupo, sem multiplicá-la pelo número de clientes.</p>}
    <div className="space-y-1.5"><Label htmlFor={`${prefix}-observacao`}>{tipoBase === "encaminhada_time_interno" ? "Setor/responsável interno (opcional)" : tipoBase === "redirecionada_varias" ? "Grupo ou critério de envio (opcional)" : "Observação da destinação (opcional)"}</Label><Input id={`${prefix}-observacao`} value={value.observacao} onChange={e => onChange({ ...value, observacao: e.target.value })} maxLength={1000} placeholder={tipoBase === "redirecionada_varias" ? "Ex.: DEC Anatel para todas as empresas" : undefined} /></div>
  </div>;
}
