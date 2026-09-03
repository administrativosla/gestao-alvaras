export const CAMPOS_CADASTRO = [
  { campo: "cnpj", label: "CNPJ", grupo: "Identificação", automatizavel: false },
  { campo: "razaoSocial", label: "Razão social", grupo: "Identificação", automatizavel: true },
  { campo: "nomeFantasia", label: "Nome fantasia", grupo: "Identificação", automatizavel: true },
  { campo: "dataAbertura", label: "Data de abertura", grupo: "Identificação", automatizavel: true },
  { campo: "situacaoCadastral", label: "Situação cadastral", grupo: "Receita Federal", automatizavel: true },
  { campo: "cnaePrincipal", label: "CNAE principal", grupo: "Receita Federal", automatizavel: true },
  { campo: "logradouro", label: "Logradouro", grupo: "Endereço", automatizavel: true },
  { campo: "numero", label: "Número", grupo: "Endereço", automatizavel: true },
  { campo: "cidade", label: "Cidade", grupo: "Endereço", automatizavel: true },
  { campo: "uf", label: "UF", grupo: "Endereço", automatizavel: true },
  { campo: "cep", label: "CEP", grupo: "Endereço", automatizavel: true },
  { campo: "inscricaoEstadual", label: "Inscrição estadual", grupo: "Inscrições fiscais", automatizavel: true },
  { campo: "inscricaoMunicipal", label: "Inscrição municipal", grupo: "Inscrições fiscais", automatizavel: true },
  { campo: "nomeContato", label: "Contato responsável", grupo: "Contato", automatizavel: false },
  { campo: "telefone", label: "Telefone", grupo: "Contato", automatizavel: false },
  { campo: "email", label: "E-mail", grupo: "Contato", automatizavel: false },
] as const;

export type CampoCadastro = (typeof CAMPOS_CADASTRO)[number]["campo"];
export type CompletudeStatus = "Completo" | "Em complementação" | "Crítico";

export type DadosParaCompletude = Partial<Record<CampoCadastro, unknown>>;

export interface PendenciaCadastro {
  campo: CampoCadastro;
  label: string;
  grupo: string;
  automatizavel: boolean;
}

export interface FiltrosCompletudeCadastro {
  status?: CompletudeStatus;
  pendencia?: CampoCadastro;
}

function possuiValor(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === "string") return valor.trim().length > 0;
  return true;
}

export function avaliarCompletudeCadastro(dados: DadosParaCompletude) {
  const pendencias: PendenciaCadastro[] = CAMPOS_CADASTRO
    .filter(({ campo }) => !possuiValor(dados[campo]))
    .map(({ campo, label, grupo, automatizavel }) => ({ campo, label, grupo, automatizavel }));

  const totalCampos = CAMPOS_CADASTRO.length;
  const camposPreenchidos = totalCampos - pendencias.length;
  const percentual = Math.round((camposPreenchidos / totalCampos) * 100);
  const possuiPendenciaFiscal = pendencias.some(({ campo }) =>
    campo === "inscricaoEstadual" || campo === "inscricaoMunicipal"
  );
  const status: CompletudeStatus = percentual >= 85 && !possuiPendenciaFiscal
    ? "Completo"
    : percentual >= 55
      ? "Em complementação"
      : "Crítico";

  return { percentual, status, pendencias, camposPreenchidos, totalCampos };
}

export function correspondeAosFiltrosCompletude(
  completude: ReturnType<typeof avaliarCompletudeCadastro>,
  filtros: FiltrosCompletudeCadastro,
): boolean {
  if (filtros.status && completude.status !== filtros.status) return false;
  if (filtros.pendencia && !completude.pendencias.some((item) => item.campo === filtros.pendencia)) return false;
  return true;
}
