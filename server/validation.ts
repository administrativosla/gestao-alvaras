/**
 * Motor de Validação — Fase 3
 *
 * Cruza os dados extraídos do PDF do alvará com as informações da Receita Federal
 * armazenadas no cadastro do cliente, gerando um resultado estruturado por dimensão:
 *   - situacao:  situação cadastral da empresa (ATIVA / BAIXADA / SUSPENSA)
 *   - endereco:  endereço do alvará vs. endereço da Receita
 *   - cnae:      atividades licenciadas no alvará vs. CNAEs declarados na Receita
 */

export type ResultadoValidacao = "ok" | "divergente" | "inconclusivo";

export interface DimensaoValidacao {
  resultado: ResultadoValidacao;
  detalhe: string;
}

export interface ResultadoValidacaoCompleto {
  situacao: DimensaoValidacao;
  endereco: DimensaoValidacao;
  cnae: DimensaoValidacao;
  /** JSON serializado para persistência no banco */
  detalhesJson: string;
  /** Timestamp da execução */
  executadoEm: Date;
}

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

interface DadosPdf {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  tipo?: string | null;
  orgaoEmissor?: string | null;
  /** Atividades mencionadas no texto do alvará (extraídas pelo LLM) */
  atividadesLicenciadas?: string[] | null;
}

interface DadosCliente {
  situacaoCadastral?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  cnaePrincipal?: string | null;
  cnaePrincipalDescricao?: string | null;
  cnaesSecundarios?: string | null; // JSON string
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function normalizarTexto(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCep(cep: string | null | undefined): string {
  if (!cep) return "";
  return cep.replace(/\D/g, "").padStart(8, "0");
}

function normalizarCnae(codigo: string | null | undefined): string {
  if (!codigo) return "";
  return codigo.replace(/\D/g, "");
}

// ─── Validação de Situação Cadastral ─────────────────────────────────────────

function validarSituacaoCadastral(cliente: DadosCliente): DimensaoValidacao {
  if (!cliente.situacaoCadastral) {
    return {
      resultado: "inconclusivo",
      detalhe: "Situação cadastral não disponível — dados da Receita Federal ainda não carregados.",
    };
  }

  const situacao = cliente.situacaoCadastral.toUpperCase();

  if (situacao === "ATIVA") {
    return {
      resultado: "ok",
      detalhe: "Empresa com situação cadastral ATIVA na Receita Federal.",
    };
  }

  if (situacao === "BAIXADA") {
    return {
      resultado: "divergente",
      detalhe: `Empresa com situação BAIXADA na Receita Federal. Alvará emitido para empresa sem registro ativo.`,
    };
  }

  if (situacao === "SUSPENSA" || situacao === "INAPTA") {
    return {
      resultado: "divergente",
      detalhe: `Empresa com situação ${situacao} na Receita Federal. Verificar regularização antes de renovar.`,
    };
  }

  return {
    resultado: "inconclusivo",
    detalhe: `Situação cadastral "${cliente.situacaoCadastral}" — verificação manual recomendada.`,
  };
}

// ─── Validação de Endereço ────────────────────────────────────────────────────

function validarEndereco(pdf: DadosPdf, cliente: DadosCliente): DimensaoValidacao {
  // Se não há dados de endereço no PDF, inconclusivo
  if (!pdf.cidade && !pdf.cep && !pdf.logradouro) {
    return {
      resultado: "inconclusivo",
      detalhe: "Endereço não extraído do PDF — validação não realizada.",
    };
  }

  // Se não há dados da Receita, inconclusivo
  if (!cliente.cidade && !cliente.cep && !cliente.logradouro) {
    return {
      resultado: "inconclusivo",
      detalhe: "Endereço da Receita Federal não disponível — execute o enriquecimento do cadastro.",
    };
  }

  const divergencias: string[] = [];
  const correspondencias: string[] = [];

  // Comparar CEP (mais confiável)
  const cepPdf = normalizarCep(pdf.cep);
  const cepReceita = normalizarCep(cliente.cep);
  if (cepPdf && cepReceita) {
    if (cepPdf === cepReceita) {
      correspondencias.push(`CEP ${pdf.cep} confere`);
    } else {
      divergencias.push(`CEP diverge: alvará "${pdf.cep}" vs Receita "${cliente.cep}"`);
    }
  }

  // Comparar município
  const cidadePdf = normalizarTexto(pdf.cidade);
  const cidadeReceita = normalizarTexto(cliente.cidade);
  if (cidadePdf && cidadeReceita) {
    if (cidadePdf === cidadeReceita || cidadeReceita.includes(cidadePdf) || cidadePdf.includes(cidadeReceita)) {
      correspondencias.push(`Município "${pdf.cidade}" confere`);
    } else {
      divergencias.push(`Município diverge: alvará "${pdf.cidade}" vs Receita "${cliente.cidade}"`);
    }
  }

  // Comparar UF
  const ufPdf = normalizarTexto(pdf.uf);
  const ufReceita = normalizarTexto(cliente.uf);
  if (ufPdf && ufReceita) {
    if (ufPdf === ufReceita) {
      correspondencias.push(`UF "${pdf.uf}" confere`);
    } else {
      divergencias.push(`UF diverge: alvará "${pdf.uf}" vs Receita "${cliente.uf}"`);
    }
  }

  // Comparar logradouro (fuzzy — apenas verifica se há sobreposição de palavras-chave)
  const logPdf = normalizarTexto(pdf.logradouro);
  const logReceita = normalizarTexto(cliente.logradouro);
  if (logPdf && logReceita && !cepPdf) {
    // Só compara logradouro se não há CEP (CEP já é suficiente)
    const palavrasPdf = logPdf.split(" ").filter((p) => p.length > 3);
    const palavrasReceita = logReceita.split(" ").filter((p) => p.length > 3);
    const sobreposicao = palavrasPdf.filter((p) => palavrasReceita.includes(p));
    if (sobreposicao.length >= 2) {
      correspondencias.push(`Logradouro "${pdf.logradouro}" confere parcialmente`);
    } else if (sobreposicao.length === 0 && palavrasPdf.length > 0) {
      divergencias.push(`Logradouro diverge: alvará "${pdf.logradouro}" vs Receita "${cliente.logradouro}"`);
    }
  }

  if (divergencias.length === 0 && correspondencias.length > 0) {
    return {
      resultado: "ok",
      detalhe: `Endereço compatível com a Receita Federal. ${correspondencias.join("; ")}.`,
    };
  }

  if (divergencias.length > 0) {
    return {
      resultado: "divergente",
      detalhe: `Divergência de endereço detectada. ${divergencias.join("; ")}.${correspondencias.length > 0 ? ` Campos compatíveis: ${correspondencias.join("; ")}.` : ""}`,
    };
  }

  return {
    resultado: "inconclusivo",
    detalhe: "Dados insuficientes para comparação de endereço.",
  };
}

// ─── Validação de CNAEs ───────────────────────────────────────────────────────

function validarCnaes(pdf: DadosPdf, cliente: DadosCliente): DimensaoValidacao {
  // Parsear CNAEs da Receita
  const cnaesReceita: string[] = [];
  if (cliente.cnaePrincipal) {
    cnaesReceita.push(normalizarCnae(cliente.cnaePrincipal));
  }
  if (cliente.cnaesSecundarios) {
    try {
      const secundarios: { codigo: string }[] = JSON.parse(cliente.cnaesSecundarios);
      secundarios.forEach((c) => {
        if (c.codigo) cnaesReceita.push(normalizarCnae(c.codigo));
      });
    } catch { /* ignorar erro de parse */ }
  }

  // Sem dados da Receita
  if (cnaesReceita.length === 0) {
    return {
      resultado: "inconclusivo",
      detalhe: "CNAEs da Receita Federal não disponíveis — execute o enriquecimento do cadastro.",
    };
  }

  // Sem atividades extraídas do PDF
  if (!pdf.atividadesLicenciadas || pdf.atividadesLicenciadas.length === 0) {
    // Tentar inferir pelo tipo do alvará
    if (pdf.tipo === "CLI") {
      return {
        resultado: "inconclusivo",
        detalhe: `CLI importado. CNAEs da Receita disponíveis (${cnaesReceita.length} atividades). Atividades licenciadas não extraídas do PDF para cruzamento automático.`,
      };
    }
    return {
      resultado: "inconclusivo",
      detalhe: "Atividades licenciadas não extraídas do PDF — cruzamento com CNAEs não realizado.",
    };
  }

  // Cruzar atividades do PDF com CNAEs da Receita
  const atividadesPdf = pdf.atividadesLicenciadas.map(normalizarTexto);
  const descricaoPrincipal = normalizarTexto(cliente.cnaePrincipalDescricao);

  let correspondencias = 0;
  const detalhes: string[] = [];

  for (const atividade of atividadesPdf) {
    // Verificar se a atividade do PDF menciona palavras do CNAE principal
    if (descricaoPrincipal) {
      const palavrasCnae = descricaoPrincipal.split(" ").filter((p) => p.length > 4);
      const matches = palavrasCnae.filter((p) => atividade.includes(p));
      if (matches.length >= 2) {
        correspondencias++;
        detalhes.push(`"${pdf.atividadesLicenciadas![atividadesPdf.indexOf(atividade)]}" corresponde ao CNAE principal`);
      }
    }
  }

  if (correspondencias > 0) {
    return {
      resultado: "ok",
      detalhe: `${correspondencias} atividade(s) licenciada(s) compatível(is) com os CNAEs da Receita. ${detalhes.join("; ")}.`,
    };
  }

  // Se há atividades no PDF mas não cruzaram com CNAEs, pode ser inconclusivo
  // (vocabulário diferente, não necessariamente divergência real)
  return {
    resultado: "inconclusivo",
    detalhe: `Não foi possível cruzar automaticamente as atividades do alvará com os CNAEs da Receita (${cnaesReceita.length} CNAEs disponíveis). Verificação manual recomendada.`,
  };
}

// ─── Função principal ─────────────────────────────────────────────────────────

export function executarValidacao(
  pdf: DadosPdf,
  cliente: DadosCliente
): ResultadoValidacaoCompleto {
  const situacao = validarSituacaoCadastral(cliente);
  const endereco = validarEndereco(pdf, cliente);
  const cnae = validarCnaes(pdf, cliente);

  const detalhes = { situacao, endereco, cnae };
  const detalhesJson = JSON.stringify(detalhes);

  return {
    situacao,
    endereco,
    cnae,
    detalhesJson,
    executadoEm: new Date(),
  };
}

/**
 * Converte o resultado de validação para os campos do schema Drizzle.
 * Usado diretamente em createAlvara / updateAlvara.
 */
export function validacaoParaCampos(v: ResultadoValidacaoCompleto) {
  return {
    validacaoSituacao: v.situacao.resultado,
    validacaoEndereco: v.endereco.resultado,
    validacaoCnae: v.cnae.resultado,
    validacaoDetalhes: v.detalhesJson,
    validacaoExecutadaEm: v.executadoEm,
  };
}
