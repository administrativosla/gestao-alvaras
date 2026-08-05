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
  /** Códigos CNAE extraídos diretamente do CLI (ex: ["4751-2/01", "4751-2/02"]) */
  cliCnaesLicenciados?: string[] | null;
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

// ─── Nota sobre prefixos CLI do VRE/REDESIM SP ────────────────────────────────
// IMPORTANTE: Os prefixos SPM e SPP no número do CLI NÃO indicam o município emissor.
// Eles identificam o TIPO DE PROTOCOLO do sistema VRE/REDESIM:
//   SPP = Protocolo de abertura/alteração de empresa (Solicitação de Pessoa Jurídica)
//   SPM = Protocolo de regularização de empresa (Evento 999)
// O município emissor real está EXPLICITAMENTE no corpo do documento:
//   Ex: "Prefeitura do Município de Barueri", "Prefeitura do Município de São Paulo"
// A validação de jurisdição deve usar o campo cliMunicipioEmissor extraído pelo LLM.

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

  // ── Verificação de jurisdição para CLI (PRIORIDADE MÁXIMA) ───────────────────
  // O município emissor do CLI está EXPLICITAMENTE no corpo do documento:
  //   Ex: "Prefeitura do Município de Barueri", "Prefeitura do Município de São Paulo"
  // NOTA: os prefixos SPM/SPP no número do CLI identificam o TIPO DE PROTOCOLO
  // do sistema VRE/REDESIM (SPP = abertura, SPM = regularização), NÃO o município.
  // O campo cliMunicipioEmissor deve ser extraído pelo LLM diretamente do documento.
  const cliMunicipioEmissor = (pdf as any).cliMunicipioEmissor as string | null | undefined;
  if (pdf.tipo === "CLI" && cliMunicipioEmissor) {
    const municipioCliNorm = normalizarTexto(cliMunicipioEmissor);
    const municipioClienteNorm = normalizarTexto(cliente.cidade);
    if (municipioClienteNorm && municipioCliNorm &&
        municipioCliNorm !== municipioClienteNorm &&
        !municipioClienteNorm.includes(municipioCliNorm) &&
        !municipioCliNorm.includes(municipioClienteNorm)) {
      return {
        resultado: "divergente",
        detalhe: `Divergência de jurisdição: o CLI foi emitido pela Prefeitura de "${cliMunicipioEmissor}" (conforme consta no documento), mas o CNPJ está cadastrado na Receita Federal com endereço em "${cliente.cidade}". Verifique se o estabelecimento correto foi licenciado no município competente.`,
      };
    }
    if (municipioClienteNorm && municipioCliNorm &&
        (municipioCliNorm === municipioClienteNorm ||
         municipioClienteNorm.includes(municipioCliNorm) ||
         municipioCliNorm.includes(municipioClienteNorm))) {
      return {
        resultado: "ok",
        detalhe: `Jurisdição confirmada: CLI emitido pela Prefeitura de "${cliMunicipioEmissor}", compatível com o município do CNPJ na Receita Federal ("${cliente.cidade}").`,
      };
    }
  }

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

  // ── Opção A: cruzamento direto por código CNAE (CLI) ────────────────────────
  // Comparação por prefixo: CLI usa 7 dígitos (6203100), Receita usa 6 dígitos (620310)
  // Ambos são normalizados para apenas dígitos e comparados por startsWith
  function cnaeCompativel(docCnae: string, receitaCnaes: string[]): boolean {
    const d = docCnae.replace(/\D/g, "");
    return receitaCnaes.some((r) => {
      const rv = r.replace(/\D/g, "");
      // Considera compatível se um é prefixo do outro (ex: 6203100 vs 620310)
      return d === rv || d.startsWith(rv) || rv.startsWith(d);
    });
  }

  if (pdf.cliCnaesLicenciados && pdf.cliCnaesLicenciados.length > 0) {
    const cnaesDocumento = pdf.cliCnaesLicenciados;
    const encontrados: string[] = [];
    const ausentes: string[] = [];

    for (const cnaeDoc of cnaesDocumento) {
      if (cnaeCompativel(cnaeDoc, cnaesReceita)) {
        encontrados.push(cnaeDoc);
      } else {
        ausentes.push(cnaeDoc);
      }
    }

    if (ausentes.length === 0) {
      return {
        resultado: "ok",
        detalhe: `Todos os CNAEs do CLI (${encontrados.join(", ")}) estão declarados na Receita Federal.`,
      };
    }

    if (encontrados.length > 0) {
      // Verificar se o CNAE principal da Receita está entre os encontrados
      const cnaePrincipalReceita = cliente.cnaePrincipal ? normalizarCnae(cliente.cnaePrincipal) : null;
      const principalCoberto = cnaePrincipalReceita
        ? cnaesDocumento.some((d) => cnaeCompativel(d, [cnaePrincipalReceita]))
        : false;

      if (principalCoberto) {
        // CNAE principal da empresa está licenciado no CLI — resultado conforme
        // CNAEs extras no CLI que não constam na Receita são normais (CLI pode licenciar mais atividades)
        return {
          resultado: "ok",
          detalhe: `CNAE principal da empresa (${cliente.cnaePrincipal}) está licenciado no CLI. ${ausentes.length} CNAE(s) do CLI não constam na Receita (${ausentes.join(", ")}) — isso é normal, o CLI pode licenciar atividades adicionais.`,
        };
      }

      // CNAE principal não coberto, mas há CNAEs secundários cobertos
      return {
        resultado: "inconclusivo",
        detalhe: `CNAEs parcialmente compatíveis. CNAE principal (${cliente.cnaePrincipal}) não encontrado no CLI. CNAEs da Receita cobertos pelo CLI: ${encontrados.join(", ")}. CNAEs do CLI não declarados na Receita: ${ausentes.join(", ")}.`,
      };
    }

    return {
      resultado: "divergente",
      detalhe: `Nenhum CNAE do CLI (${cnaesDocumento.join(", ")}) corresponde aos CNAEs declarados na Receita Federal (${cnaesReceita.length} CNAE(s) disponível(is)). Verificar atualização cadastral.`,
    };
  }

  // Sem atividades extraídas do PDF
  if (!pdf.atividadesLicenciadas || pdf.atividadesLicenciadas.length === 0) {
    return {
      resultado: "inconclusivo",
      detalhe: "Atividades licenciadas não extraídas do PDF — cruzamento com CNAEs não realizado.",
    };
  }

  // Cruzar atividades do PDF com CNAEs da Receita (alvarás não-CLI)
  const atividadesPdf = pdf.atividadesLicenciadas.map(normalizarTexto);
  const descricaoPrincipal = normalizarTexto(cliente.cnaePrincipalDescricao);

  let correspondencias = 0;
  const detalhes: string[] = [];

  for (const atividade of atividadesPdf) {
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
