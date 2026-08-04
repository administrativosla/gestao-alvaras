/**
 * Script de enriquecimento em lote — BrasilAPI → tabela clientes
 * Consulta a Receita Federal via BrasilAPI para cada CNPJ e preenche:
 * nomeFantasia, dataAbertura, logradouro, numero, complemento, bairro,
 * cidade, uf, cep, situacaoCadastral, cnaePrincipal, cnaePrincipalDescricao,
 * cnaesSecundarios, porte, naturezaJuridica, capitalSocial, dadosReceitaStatus
 *
 * Execução: node scripts/enriquecer-clientes.mjs
 */

import { createConnection } from "mysql2/promise";

const DELAY_MS = 1100; // 1.1s entre requisições para respeitar o limite da API
const BRASILAPI_URL = "https://brasilapi.com.br/api/cnpj/v1";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function limparCnpj(cnpj) {
  return cnpj.replace(/\D/g, "");
}

function formatarCapital(valor) {
  if (!valor) return null;
  return String(valor);
}

async function consultarCnpj(cnpj) {
  const cnpjLimpo = limparCnpj(cnpj);
  const url = `${BRASILAPI_URL}/${cnpjLimpo}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "GestaoAlvaras/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    if (res.status === 404) return { erro: "cnpj_invalido" };
    if (res.status === 429) return { erro: "rate_limit" };
    return { erro: `http_${res.status}` };
  }
  return res.json();
}

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);

  // Buscar todos os clientes ativos com dadosReceitaStatus = 'pendente' ou 'erro'
  const [clientes] = await conn.execute(
    `SELECT id, cnpj, razaoSocial FROM clientes
     WHERE ativo = 1 AND (dadosReceitaStatus IS NULL OR dadosReceitaStatus IN ('pendente', 'erro'))
     ORDER BY id ASC`
  );

  const total = clientes.length;
  console.log(`\n🚀 Iniciando enriquecimento de ${total} clientes...\n`);

  let ok = 0;
  let erros = 0;
  let cnpjInvalido = 0;
  let rateLimit = 0;

  for (let i = 0; i < clientes.length; i++) {
    const cliente = clientes[i];
    const progresso = `[${i + 1}/${total}]`;

    try {
      const dados = await consultarCnpj(cliente.cnpj);

      if (dados.erro === "cnpj_invalido") {
        await conn.execute(
          `UPDATE clientes SET dadosReceitaStatus = 'cnpj_invalido', dadosReceitaAtualizadoEm = NOW() WHERE id = ?`,
          [cliente.id]
        );
        cnpjInvalido++;
        console.log(`${progresso} ❌ CNPJ inválido: ${cliente.cnpj} — ${cliente.razaoSocial}`);
      } else if (dados.erro === "rate_limit") {
        // Aguardar mais tempo e tentar novamente
        console.log(`${progresso} ⏳ Rate limit — aguardando 10s...`);
        await sleep(10000);
        i--; // Repetir este item
        rateLimit++;
        continue;
      } else if (dados.erro) {
        await conn.execute(
          `UPDATE clientes SET dadosReceitaStatus = 'erro', dadosReceitaAtualizadoEm = NOW() WHERE id = ?`,
          [cliente.id]
        );
        erros++;
        console.log(`${progresso} ⚠️  Erro (${dados.erro}): ${cliente.cnpj} — ${cliente.razaoSocial}`);
      } else {
        // Montar CNAEs secundários como JSON
        const cnaesSecundarios = (dados.cnaes_secundarios || []).map((c) => ({
          codigo: c.codigo,
          descricao: c.descricao,
        }));

        // Normalizar cidade (BrasilAPI retorna em caixa alta)
        const cidade = dados.municipio
          ? dados.municipio
              .toLowerCase()
              .replace(/\b\w/g, (l) => l.toUpperCase())
          : null;

        await conn.execute(
          `UPDATE clientes SET
            nomeFantasia            = COALESCE(NULLIF(?, ''), nomeFantasia),
            dataAbertura            = COALESCE(?, dataAbertura),
            logradouro              = ?,
            numero                  = ?,
            complemento             = NULLIF(?, ''),
            bairro                  = ?,
            cidade                  = ?,
            uf                      = ?,
            cep                     = ?,
            situacaoCadastral       = ?,
            cnaePrincipal           = ?,
            cnaePrincipalDescricao  = ?,
            cnaesSecundarios        = ?,
            porte                   = ?,
            naturezaJuridica        = ?,
            capitalSocial           = ?,
            dadosReceitaStatus      = 'ok',
            dadosReceitaAtualizadoEm = NOW()
          WHERE id = ?`,
          [
            dados.nome_fantasia || null,
            dados.data_inicio_atividade || null,
            dados.logradouro || null,
            dados.numero || null,
            dados.complemento || null,
            dados.bairro || null,
            cidade,
            dados.uf || null,
            dados.cep || null,
            dados.descricao_situacao_cadastral || null,
            dados.cnae_fiscal_descricao ? String(dados.cnae_fiscal) : null,
            dados.cnae_fiscal_descricao || null,
            cnaesSecundarios.length > 0 ? JSON.stringify(cnaesSecundarios) : null,
            dados.porte || null,
            dados.natureza_juridica ? `${dados.codigo_natureza_juridica} - ${dados.natureza_juridica}` : null,
            formatarCapital(dados.capital_social),
            cliente.id,
          ]
        );

        ok++;
        console.log(`${progresso} ✅ ${cliente.cnpj} — ${cliente.razaoSocial} → ${dados.descricao_situacao_cadastral || "?"} | ${dados.cnae_fiscal_descricao || "?"}`);
      }
    } catch (err) {
      await conn.execute(
        `UPDATE clientes SET dadosReceitaStatus = 'erro', dadosReceitaAtualizadoEm = NOW() WHERE id = ?`,
        [cliente.id]
      );
      erros++;
      console.log(`${progresso} ⚠️  Exceção: ${cliente.cnpj} — ${err.message}`);
    }

    // Aguardar entre requisições (exceto na última)
    if (i < clientes.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  await conn.end();

  console.log(`
╔══════════════════════════════════════════╗
║         ENRIQUECIMENTO CONCLUÍDO         ║
╠══════════════════════════════════════════╣
║  Total processado : ${String(total).padStart(5)}                  ║
║  ✅ Sucesso        : ${String(ok).padStart(5)}                  ║
║  ❌ CNPJ inválido  : ${String(cnpjInvalido).padStart(5)}                  ║
║  ⚠️  Erros          : ${String(erros).padStart(5)}                  ║
║  ⏳ Rate limits    : ${String(rateLimit).padStart(5)}                  ║
╚══════════════════════════════════════════╝
`);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
