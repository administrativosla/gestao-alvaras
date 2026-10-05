import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPOS_DESTINACAO_DEC, type TipoDestinacaoDec } from "@shared/decTipos";

export type DestinacaoFormDec = {
  tipo: TipoDestinacaoDec;
  quantidade: string;
  clienteId: number | null;
  clienteNome: string;
  observacao: string;
};

export function destinoVazioDec(): DestinacaoFormDec {
  return { tipo: "redirecionada_ativo", quantidade: "", clienteId: null, clienteNome: "", observacao: "" };
}

export function DecDestinacaoCampos({ value, onChange, max, prefix }: {
  value: DestinacaoFormDec;
  onChange: (value: DestinacaoFormDec) => void;
  max: number;
  prefix: string;
}) {
  const precisaCliente = value.tipo === "redirecionada_ativo" || value.tipo === "arquivada_inativo";
  const pesquisa = value.clienteNome.trim();
  const { data: clientes = [] } = trpc.dec.clientes.useQuery({ pesquisa }, { enabled: precisaCliente && !value.clienteId && pesquisa.length >= 2 });
  const encontrados = clientes.filter(cliente => value.tipo === "redirecionada_ativo" ? cliente.ativo : !cliente.ativo);

  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor={`${prefix}-tipo`}>Destinação</Label>
        <Select value={value.tipo} onValueChange={tipo => onChange({ ...value, tipo: tipo as TipoDestinacaoDec, clienteId: null, clienteNome: "" })}>
          <SelectTrigger id={`${prefix}-tipo`}><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(TIPOS_DESTINACAO_DEC).map(([tipo, nome]) => <SelectItem key={tipo} value={tipo}>{nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label htmlFor={`${prefix}-quantidade`}>Quantidade destinada</Label><Input id={`${prefix}-quantidade`} type="number" inputMode="numeric" min={1} max={max} step={1} required value={value.quantidade} onChange={e => onChange({ ...value, quantidade: e.target.value })} /></div>
    </div>
    {precisaCliente && <div className="space-y-1.5"><Label htmlFor={`${prefix}-cliente`}>{value.tipo === "redirecionada_ativo" ? "Cliente ativo (obrigatório)" : "Cliente inativo (opcional)"}</Label>
      <Input id={`${prefix}-cliente`} value={value.clienteNome} onChange={e => onChange({ ...value, clienteNome: e.target.value, clienteId: null })} placeholder="Busque por razão social ou CNPJ" />
      {value.clienteId && <p className="text-xs text-teal-700">Cliente selecionado</p>}
      {value.tipo === "arquivada_inativo" && !value.clienteId && <p className="text-xs text-muted-foreground">Se o cliente inativo não estiver cadastrado, anote-o na observação.</p>}
      {pesquisa.length >= 2 && !value.clienteId && <div className="max-h-32 overflow-y-auto rounded-md border bg-background" role="listbox">{encontrados.map(cliente => <button type="button" role="option" aria-selected={false} key={cliente.id} onClick={() => onChange({ ...value, clienteId: cliente.id, clienteNome: `${cliente.razaoSocial} · ${cliente.cnpj}` })} className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50">{cliente.razaoSocial} · {cliente.cnpj}</button>)}{!encontrados.length && <p className="p-3 text-sm text-muted-foreground">Nenhum cliente com este status encontrado.</p>}</div>}
    </div>}
    {value.tipo === "encaminhada_time_interno" && <p className="rounded-md border border-indigo-200 bg-indigo-50 p-2 text-xs text-indigo-900">Sem vínculo a cliente; informe o setor ou responsável no campo abaixo, se desejar.</p>}
    <div className="space-y-1.5"><Label htmlFor={`${prefix}-observacao`}>{value.tipo === "encaminhada_time_interno" ? "Setor/responsável interno (opcional)" : "Observação da destinação (opcional)"}</Label><Input id={`${prefix}-observacao`} value={value.observacao} onChange={e => onChange({ ...value, observacao: e.target.value })} maxLength={1000} /></div>
  </div>;
}
