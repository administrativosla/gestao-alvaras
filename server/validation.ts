/**
 * Motor de Validação — Versão Definitiva
 *
 * Implementa as 4 regras de conformidade do CLI/Alvará com a Receita Federal:
 *
 *   1. SITUAÇÃO CADASTRAL: empresa deve estar ATIVA na RFB.
 *   2. ENDEREÇO: o endereço do estabelecimento no CLI deve ser IDÊNTICO ao da RFB.
 *      Verificação tripla para CLI:
 *        a) cliMunicipioEmissor (prefeitura do cabeçalho) = cidade do CNPJ na RFB
 *        b) cliCidade (endereço do estabelecimento no CLI) = cidade do CNPJ na RFB
 *        c) cliCep (CEP do estabelecimento no CLI) = CEP do CNPJ na RFB
 *   3. CNAE PRINCIPAL: o CNAE principal do CNPJ deve estar licenciado no CLI/Alvará.
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

export interface DadosPdf {
  tipo?: string | null;
  orgaoEmissor?: string | null;
  /** Atividades mencionadas no texto do alvará (extraídas pelo LLM) */
  atividadesLicenciadas?: string[] | null;
  /** Códigos CNAE extraídos diretamente do CLI (ex: ["4751-2/01", "4751-2/02"]) */
  cliCnaesLicenciados?: string[] | null;
  /** Município emissor: nome da prefeitura no CABEÇALHO do CLI ("Prefeitura do Município de X") */
  cliMunicipioEmissor?: string | null;
  /** Endereço do ESTABELECIMENTO conforme seção "DADOS DA EMPRESA" do CLI */
  cliLogradouro?: string | null;
  cliNumero?: string | null;
  cliBairro?: string | null;
  cliCidade?: string | null;
  cliUf?: string | null;
  cliCep?: string | null;
}

export interface DadosCliente {
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
    .replace(/[\u0300-\u036f]/g, "")
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

function municipiosIguais(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ─── Regra 1: Situação Cadastral ─────────────────────────────────────────────

function validarSituacaoCadastral(cliente: DadosCliente): DimensaoValidacao {
  if (!cliente.situacaoCadastral) {
    return {
      resultado: "inconclusivo",
      detalhe: "Situação cadastral não disponível — dados da Receita Federal ainda não carregados. Execute o enriquecimento do cadastro.",
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
      detalhe: "Empresa com situação BAIXADA na Receita Federal. Alvará emitido para empresa sem registro ativo.",
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

// ─── Regra 2: Endereço do Estabelecimento ────────────────────────────────────
//
// Para CLI: usa os campos cliCidade, cliCep, cliLogradouro (endereço do estabelecimento
// extraído da seção "DADOS DA EMPRESA") e cliMunicipioEmissor (prefeitura do cabeçalho).
//
// Verificação tripla:
//   1. cliMunicipioEmissor (cabeçalho) deve bater com cliente.cidade (RFB)
//   2. cliCidade (endereço do estabelecimento no CLI) deve bater com cliente.cidade (RFB)
//   3. cliCep (CEP do estabelecimento no CLI) deve bater com cliente.cep (RFB)
//
// Qualquer divergência = resultado "divergente".
// Se não há dados suficientes = "inconclusivo".

function validarEndereco(pdf: DadosPdf, cliente: DadosCliente): DimensaoValidacao {
  const eCli = pdf.tipo === "CLI";

  // ── Validação específica para CLI ──────────────────────────────────────────
  if (eCli) {
    const temDadosCli = pdf.cliCidade || pdf.cliCep || pdf.cliMunicipioEmissor;
    const temDadosReceita = cliente.cidade || cliente.cep;

    if (!temDadosCli) {
      return {
        resultado: "inconclusivo",
        detalhe: "Endereço do estabelecimento não extraído do CLI — execute o reprocessamento do PDF para preencher os campos de endereço.",
      };
    }

    if (!temDadosReceita) {
      return {
        resultado: "inconclusivo",
        detalhe: "Endereço da Receita Federal não disponível — execute o enriquecimento do cadastro do cliente.",
      };
    }

    const divergencias: string[] = [];
    const confirmacoes: string[] = [];

    // Verificação 1: município emissor (cabeçalho do CLI) vs. cidade da RFB
    if (pdf.cliMunicipioEmissor && cliente.cidade) {
      if (municipiosIguais(pdf.cliMunicipioEmissor, cliente.cidade)) {
        confirmacoes.push(`Prefeitura emissora "${pdf.cliMunicipioEmissor}" coincide com o município do CNPJ na RFB`);
      } else {
        divergencias.push(`Prefeitura emissora do CLI é "${pdf.cliMunicipioEmissor}", mas o CNPJ está registrado na RFB em "${cliente.cidade}". O CLI foi emitido pelo município errado.`);
      }
    }

    // Verificação 2: cidade do estabelecimento no CLI vs. cidade da RFB
    if (pdf.cliCidade && cliente.cidade) {
      if (municipiosIguais(pdf.cliCidade, cliente.cidade)) {
        confirmacoes.push(`Município do estabelecimento no CLI ("${pdf.cliCidade}") coincide com a RFB`);
      } else {
        divergencias.push(`Município do estabelecimento no CLI é "${pdf.cliCidade}", mas a RFB registra "${cliente.cidade}". O endereço do estabelecimento diverge.`);
      }
    }

    // Verificação 3: CEP do estabelecimento no CLI vs. CEP da RFB
    const cepCli = normalizarCep(pdf.cliCep);
    const cepReceita = normalizarCep(cliente.cep);
    if (cepCli && cepReceita) {
      if (cepCli === cepReceita) {
        confirmacoes.push(`CEP do estabelecimento no CLI (${pdf.cliCep}) confere com a RFB`);
      } else {
        divergencias.push(`CEP do estabelecimento no CLI é "${pdf.cliCep}", mas a RFB registra "${cliente.cep}".`);
      }
    }

    // Verificação 4: logradouro (comparação fuzzy — apenas se não há CEP)
    if (!cepCli && pdf.cliLogradouro && cliente.logradouro) {
      const logCli = normalizarTexto(pdf.cliLogradouro);
      const logReceita = normalizarTexto(cliente.logradouro);
      const palavrasCli = logCli.split(" ").filter(p => p.length > 3);
      const palavrasReceita = logReceita.split(" ").filter(p => p.length > 3);
      const sobreposicao = palavrasCli.filter(p => palavrasReceita.includes(p));
      if (sobreposicao.length >= 2) {
        confirmacoes.push(`Logradouro "${pdf.cliLogradouro}" confere parcialmente com a RFB`);
      } else if (sobreposicao.length === 0 && palavrasCli.length > 0) {
        divergencias.push(`Logradouro do CLI "${pdf.cliLogradouro}" diverge do registrado na RFB "${cliente.logradouro}".`);
      }
    }

    if (divergencias.length > 0) {
      return {
        resultado: "divergente",
        detalhe: `Endereço divergente. ${divergencias.join(" ")}${confirmacoes.length > 0 ? ` Campos compatíveis: ${confirmacoes.join("; ")}.` : ""}`,
      };
    }

    if (confirmacoes.length > 0) {
      return {
        resultado: "ok",
        detalhe: `Endereço do estabelecimento compatível com a Receita Federal. ${confirmacoes.join("; ")}.`,
      };
    }

    return {
      resultado: "inconclusivo",
      detalhe: "Dados insuficientes para comparar o endereço do CLI com a Receita Federal.",
    };
  }

  // ── Validação para alvarás não-CLI ─────────────────────────────────────────
  // Para alvarás comuns, não temos os campos cliCidade/cliCep separados.
  // Retorna inconclusivo — validação manual recomendada.
  return {
    resultado: "inconclusivo",
    detalhe: "Validação de endereço automática disponível apenas para CLIs. Para alvarás comuns, verifique manualmente se o endereço do estabelecimento coincide com o registrado na Receita Federal.",
  };
}

// ─── Regra 3 + 4: CNAEs ───────────────────────────────────────────────────────
//
// Regra 3: PELO MENOS o CNAE principal do CNPJ deve estar licenciado no CLI/Alvará.
// Regra 4: CNAEs extras no CLI (não declarados na RFB) são normais — CLI pode licenciar mais.

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

  if (cnaesReceita.length === 0) {
    return {
      resultado: "inconclusivo",
      detalhe: "CNAEs da Receita Federal não disponíveis — execute o enriquecimento do cadastro.",
    };
  }

  // Função de compatibilidade: considera prefixo (7 dígitos CLI vs 6 dígitos RFB)
  function cnaeCompativel(docCnae: string, receitaCnaes: string[]): boolean {
    const d = docCnae.replace(/\D/g, "");
    return receitaCnaes.some((r) => {
      const rv = r.replace(/\D/g, "");
      return d === rv || d.startsWith(rv) || rv.startsWith(d);
    });
  }

  // ── Cruzamento direto por código CNAE (CLI) ──────────────────────────────
  if (pdf.cliCnaesLicenciados && pdf.cliCnaesLicenciados.length > 0) {
    const cnaesDocumento = pdf.cliCnaesLicenciados;

    // Verificar se o CNAE PRINCIPAL da Receita está coberto no CLI (Regra 3)
    const cnaePrincipalReceita = cliente.cnaePrincipal ? normalizarCnae(cliente.cnaePrincipal) : null;
    const principalCoberto = cnaePrincipalReceita
      ? cnaesDocumento.some((d) => cnaeCompativel(d, [cnaePrincipalReceita]))
      : false;

    // Verificar quais CNAEs do CLI constam na RFB e quais não constam
    const encontrados = cnaesDocumento.filter(d => cnaeCompativel(d, cnaesReceita));
    const ausentes = cnaesDocumento.filter(d => !cnaeCompativel(d, cnaesReceita));

    if (principalCoberto) {
      if (ausentes.length === 0) {
        return {
          resultado: "ok",
          detalhe: `CNAE principal (${cliente.cnaePrincipal}) e todos os CNAEs do CLI estão declarados na Receita Federal.`,
        };
      }
      // CNAEs extras no CLI são normais
      return {
        resultado: "ok",
        detalhe: `CNAE principal da empresa (${cliente.cnaePrincipal}) está licenciado no CLI. ${ausentes.length} CNAE(s) do CLI não constam na Receita (${ausentes.join(", ")}) — isso é normal, o CLI pode licenciar atividades adicionais.`,
      };
    }

    // CNAE principal não coberto
    if (encontrados.length > 0) {
      return {
        resultado: "inconclusivo",
        detalhe: `CNAE principal da empresa (${cliente.cnaePrincipal}) NÃO está licenciado no CLI. CNAEs secundários cobertos: ${encontrados.join(", ")}. CNAEs do CLI não declarados na Receita: ${ausentes.join(", ")}. Verificar se a atividade principal está regularizada.`,
      };
    }

    return {
      resultado: "divergente",
      detalhe: `CNAE principal (${cliente.cnaePrincipal}) e nenhum CNAE da Receita Federal constam no CLI (${cnaesDocumento.join(", ")}). O estabelecimento pode não estar licenciado para sua atividade principal.`,
    };
  }

  // Sem CNAEs extraídos do PDF
  if (!pdf.atividadesLicenciadas || pdf.atividadesLicenciadas.length === 0) {
    return {
      resultado: "inconclusivo",
      detalhe: "Atividades licenciadas não extraídas do PDF — cruzamento com CNAEs não realizado.",
    };
  }

  // Cruzar atividades textuais do PDF com CNAEs da Receita (alvarás não-CLI)
  const atividadesPdf = pdf.atividadesLicenciadas.map(normalizarTexto);
  const descricaoPrincipal = normalizarTexto(cliente.cnaePrincipalDescricao);
  let correspondencias = 0;

  for (const atividade of atividadesPdf) {
    if (descricaoPrincipal) {
      const palavrasCnae = descricaoPrincipal.split(" ").filter((p) => p.length > 4);
      const matches = palavrasCnae.filter((p) => atividade.includes(p));
      if (matches.length >= 2) correspondencias++;
    }
  }

  if (correspondencias > 0) {
    return {
      resultado: "ok",
      detalhe: `${correspondencias} atividade(s) licenciada(s) compatível(is) com o CNAE principal da Receita.`,
    };
  }

  return {
    resultado: "inconclusivo",
    detalhe: `Não foi possível cruzar automaticamente as atividades do alvará com os CNAEs da Receita. Verificação manual recomendada.`,
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
