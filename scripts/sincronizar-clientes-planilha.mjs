#!/usr/bin/env node
/**
 * Sincroniza dados cadastrais e comerciais de uma planilha XLSX para o Portal Controller.
 *
 * Uso seguro (prévia):
 *   node scripts/sincronizar-clientes-planilha.mjs --file /caminho/base.xlsx
 *
 * Aplicação definitiva:
 *   node scripts/sincronizar-clientes-planilha.mjs --file /caminho/base.xlsx --apply
 *
 * Regras de segurança:
 * - Concilia exclusivamente por CNPJ válido;
 * - Não exclui clientes e não altera campos fiscais, alvarás, CLIs ou status Sem Registro;
 * - Não aplica CNPJs inválidos nem CNPJs repetidos na fonte;
 * - Só atualiza campos principais quando há valor válido na planilha;
 * - Armazena grupo, classificação, situações e contatos complementares em
 *   cliente_dados_comerciais, sem sobrecarregar dados fiscais/cadastrais.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";
import XLSX from "xlsx";

const ARGS = process.argv.slice(2);
const fileArgIndex = ARGS.indexOf("--file");
const sourceFile = fileArgIndex >= 0 ? ARGS[fileArgIndex + 1] : null;
const apply = ARGS.includes("--apply");
const reportArgIndex = ARGS.indexOf("--report");
const reportFile = reportArgIndex >= 0
  ? ARGS[reportArgIndex + 1]
  : path.resolve("references", `relatorio_atualizacao_clientes_${new Date().toISOString().slice(0, 10)}.md`);
const exceptionsArgIndex = ARGS.indexOf("--exceptions");
const exceptionsFile = exceptionsArgIndex >= 0
  ? ARGS[exceptionsArgIndex + 1]
  : path.resolve("references", `atualizacao_clientes_excecoes_${new Date().toISOString().slice(0, 10)}.csv`);

if (!sourceFile || !fs.existsSync(sourceFile)) {
  console.error("Informe um arquivo XLSX existente: --file /caminho/arquivo.xlsx");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não está configurada.");
  process.exit(1);
}

const SOURCE_COLUMNS = {
  empresa: "Empresa",
  cnpj: "CNPJ",
  grupo: "Grupo",
  classificacao: "Classificação",
  situacaoBase: "Situação Base",
  situacaoOnvio: "Situação Onvio",
  contatoPrimario: "Telefone/WhatsApp - 1",
  emailPrimario: "Email Principal",
  contatoSecundario: "Telefone/WhatsApp - 2",
  emailSecundario: "Email Secundário",
  servicosUtilizados: "Serviços Utilizados",
};

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanText(value, max = 1000) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function normalizeCnpj(value) {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "number" ? String(Math.trunc(value)) : String(value);
  const digits = raw.replace(/\D/g, "");
  return digits ? digits.padStart(14, "0") : null;
}

function formatCnpj(cnpj) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function cnpjValido(cnpj) {
  if (!cnpj || cnpj.length !== 14 || /^([0-9])\1+$/.test(cnpj)) return false;
  const calculateDigit = (digits, weights) => {
    const sum = digits.split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? "0" : String(11 - remainder);
  };
  return calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === cnpj[12]
    && calculateDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === cnpj[13];
}

function isValidEmail(email) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractContact(raw) {
  const value = cleanText(raw, 255);
  if (!value) return { nomeContato: null, telefone: null };
  const match = value.match(/^(.*?)\s+(?:-|–|—)\s*(\(?\d{2}\)?\s*\d[\d\s.-]{7,})$/);
  if (!match) return { nomeContato: value, telefone: null };
  const nomeContato = cleanText(match[1], 255);
  const phoneDigits = match[2].replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 13) return { nomeContato: value, telefone: null };
  const telefone = match[2].replace(/\s+/g, " ").trim().slice(0, 20);
  return { nomeContato, telefone };
}

function sourceRowFromWorksheet(row, headerMap, rowNumber) {
  const get = (field) => {
    const header = normalizeHeader(SOURCE_COLUMNS[field]);
    const index = headerMap.get(header);
    return index === undefined ? null : row[index];
  };
  const cnpj = normalizeCnpj(get("cnpj"));
  const contatoPrimario = cleanText(get("contatoPrimario"), 255);
  const contatoSecundario = cleanText(get("contatoSecundario"), 255);
  const emailPrimario = cleanText(get("emailPrimario"), 320);
  const emailSecundario = cleanText(get("emailSecundario"), 320);
  const extractedPrimary = extractContact(contatoPrimario);

  return {
    rowNumber,
    cnpj,
    razaoSocial: cleanText(get("empresa"), 255),
    grupo: cleanText(get("grupo"), 255),
    classificacao: cleanText(get("classificacao"), 64),
    situacaoBase: cleanText(get("situacaoBase"), 32),
    situacaoOnvio: cleanText(get("situacaoOnvio"), 32),
    contatoPrimario,
    emailPrimario,
    contatoSecundario,
    emailSecundario,
    servicosUtilizados: cleanText(get("servicosUtilizados"), 5000),
    nomeContato: extractedPrimary.nomeContato,
    telefone: extractedPrimary.telefone,
  };
}

function recordsAreEquivalent(records) {
  const comparableFields = [
    "razaoSocial", "grupo", "classificacao", "situacaoBase", "situacaoOnvio",
    "contatoPrimario", "emailPrimario", "contatoSecundario", "emailSecundario", "servicosUtilizados",
  ];
  return comparableFields.every((field) => new Set(records.map((record) => record[field] ?? "")).size === 1);
}

function compareFields(current, desired) {
  const changed = {};
  for (const [field, value] of Object.entries(desired)) {
    if (value === null || value === undefined || value === "") continue;
    if ((current[field] ?? null) !== value) changed[field] = { before: current[field] ?? null, after: value };
  }
  return changed;
}

function populatedFields(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function prepareOutputDirectory(fileName) {
  fs.mkdirSync(path.dirname(fileName), { recursive: true });
}

function reportMarkdown(summary, exceptions) {
  const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const lines = [
    "# Relatório de Atualização da Base de Clientes",
    "",
    `- **Data da execução:** ${timestamp} (America/Sao_Paulo)`,
    `- **Modo:** ${summary.apply ? "Aplicação definitiva" : "Prévia — nenhuma alteração foi gravada"}`,
    `- **Arquivo de origem:** \`${summary.sourceFileName}\``,
    `- **Aba processada:** \`${summary.sheetName}\``,
    "",
    "## Resultado",
    "",
    "| Indicador | Quantidade |",
    "|---|---:|",
    `| Linhas preenchidas na planilha | ${summary.rowsRead} |`,
    `| CNPJs únicos válidos na fonte | ${summary.uniqueValidCnpjs} |`,
    `| CNPJs correspondentes à base existente | ${summary.matchedExisting} |`,
    `| Novos clientes criados | ${summary.created} |`,
    `| Clientes cadastrados atualizados | ${summary.updatedClients} |`,
    `| Registros comerciais criados | ${summary.createdCommercial} |`,
    `| Registros comerciais atualizados | ${summary.updatedCommercial} |`,
    `| Registros sem alteração | ${summary.unchanged} |`,
    `| CNPJs inválidos ignorados | ${summary.invalidCnpjs} |`,
    `| CNPJs duplicados/conflitantes ignorados | ${summary.duplicateCnpjs} |`,
    `| E-mails principais inválidos preservados apenas como referência comercial | ${summary.invalidPrimaryEmails} |`,
    "",
    "## Campos atualizados",
    "",
    "### Cadastro principal (`clientes`)",
    "",
    "Foram atualizados apenas campos equivalentes e preenchidos na planilha: **Razão Social**, **Nome do Contato**, **Telefone** e **E-mail principal**. Campos sem valor na fonte não substituíram valores existentes. Não houve exclusão automática, nem alteração de dados fiscais, endereço, alvarás, CLIs, PDFs, validações ou da marcação `Sem Registro`.",
    "",
    "### Dados comerciais complementares (`cliente_dados_comerciais`)",
    "",
    "Foram mantidos, por cliente: grupo, classificação, situação na base, situação no Onvio, contatos e e-mails primário/secundário, serviços utilizados, arquivo e linha de origem. Essa separação conserva a informação da planilha sem misturá-la ao cadastro fiscal e operacional do portal.",
    "",
    "## Tratamento de exceções",
    "",
    "CNPJs inválidos e CNPJs repetidos na fonte foram excluídos da atualização para evitar que uma linha potencialmente incorreta ou conflitante substituísse dados do portal. O arquivo CSV complementar contém o detalhe dessas ocorrências.",
    "",
    "| Tipo | Quantidade |",
    "|---|---:|",
    ...Object.entries(exceptions.reduce((acc, item) => { acc[item.type] = (acc[item.type] ?? 0) + 1; return acc; }, {})).map(([type, count]) => `| ${type} | ${count} |`),
    "",
  ];

  if (summary.fieldChanges && Object.keys(summary.fieldChanges).length > 0) {
    lines.push("## Alterações por campo", "", "| Campo | Registros alterados |", "|---|---:|");
    for (const [field, count] of Object.entries(summary.fieldChanges)) lines.push(`| ${field} | ${count} |`);
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const workbook = XLSX.readFile(sourceFile, { cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("A planilha não possui abas.");
  const worksheet = workbook.Sheets[sheetName];
  // CNPJs estão armazenados como números na fonte; `raw: true` evita a conversão
  // para notação científica/formatação de exibição do Excel.
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true });
  const headers = rows[0] ?? [];
  const headerMap = new Map(headers.map((header, index) => [normalizeHeader(header), index]).filter(([header]) => header));
  const missingColumns = ["Empresa", "CNPJ"].filter((column) => !headerMap.has(normalizeHeader(column)));
  if (missingColumns.length > 0) throw new Error(`Colunas obrigatórias ausentes: ${missingColumns.join(", ")}`);

  const parsedRows = rows.slice(1)
    .map((row, index) => sourceRowFromWorksheet(row, headerMap, index + 2))
    .filter((row) => row.razaoSocial || row.cnpj);
  const exceptions = [];
  const groupedByCnpj = new Map();
  for (const row of parsedRows) {
    if (!cnpjValido(row.cnpj)) {
      exceptions.push({ type: "CNPJ inválido", line: row.rowNumber, cnpj: row.cnpj ?? "", empresa: row.razaoSocial ?? "", detail: "Registro não aplicado" });
      continue;
    }
    const group = groupedByCnpj.get(row.cnpj) ?? [];
    group.push(row);
    groupedByCnpj.set(row.cnpj, group);
  }

  const sourceRecords = [];
  for (const [cnpj, records] of groupedByCnpj.entries()) {
    if (records.length > 1) {
      const equivalent = recordsAreEquivalent(records);
      exceptions.push({
        type: equivalent ? "CNPJ duplicado idêntico" : "CNPJ duplicado conflitante",
        line: records.map((record) => record.rowNumber).join(", "),
        cnpj,
        empresa: records.map((record) => record.razaoSocial).join(" | "),
        detail: equivalent ? "Registros idênticos ignorados por segurança" : "Dados conflitantes ignorados por segurança",
      });
      continue;
    }
    sourceRecords.push(records[0]);
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [clientRows] = await connection.query(
      "SELECT id, cnpj, razaoSocial, nomeContato, telefone, email FROM clientes"
    );
    const [commercialRows] = await connection.query(
      "SELECT id, clienteId, grupo, classificacao, situacaoBase, situacaoOnvio, contatoPrimario, emailPrimario, contatoSecundario, emailSecundario, servicosUtilizados FROM cliente_dados_comerciais"
    );
    const clientsByCnpj = new Map(clientRows.map((client) => [String(client.cnpj).replace(/\D/g, ""), client]));
    const commercialByClientId = new Map(commercialRows.map((record) => [Number(record.clienteId), record]));

    const summary = {
      apply,
      sourceFileName: path.basename(sourceFile),
      sheetName,
      rowsRead: parsedRows.length,
      uniqueValidCnpjs: sourceRecords.length,
      matchedExisting: 0,
      created: 0,
      updatedClients: 0,
      createdCommercial: 0,
      updatedCommercial: 0,
      unchanged: 0,
      invalidCnpjs: exceptions.filter((item) => item.type === "CNPJ inválido").length,
      duplicateCnpjs: exceptions.filter((item) => item.type.includes("CNPJ duplicado")).length,
      invalidPrimaryEmails: 0,
      fieldChanges: {},
    };

    const actions = [];
    for (const source of sourceRecords) {
      const formattedCnpj = formatCnpj(source.cnpj);
      const existing = clientsByCnpj.get(source.cnpj);
      if (existing) summary.matchedExisting++;
      const validEmail = isValidEmail(source.emailPrimario);
      if (source.emailPrimario && !validEmail) {
        summary.invalidPrimaryEmails++;
        exceptions.push({ type: "E-mail principal inválido", line: source.rowNumber, cnpj: formattedCnpj, empresa: source.razaoSocial ?? "", detail: source.emailPrimario });
      }

      const desiredClient = {
        razaoSocial: source.razaoSocial,
        nomeContato: source.nomeContato,
        telefone: source.telefone,
        email: validEmail ? source.emailPrimario : null,
      };
      const clientChanges = existing ? compareFields(existing, desiredClient) : populatedFields(desiredClient);
      const existingCommercial = existing ? commercialByClientId.get(Number(existing.id)) : null;
      const desiredCommercial = {
        grupo: source.grupo,
        classificacao: source.classificacao,
        situacaoBase: source.situacaoBase,
        situacaoOnvio: source.situacaoOnvio,
        contatoPrimario: source.contatoPrimario,
        emailPrimario: source.emailPrimario,
        contatoSecundario: source.contatoSecundario,
        emailSecundario: source.emailSecundario,
        servicosUtilizados: source.servicosUtilizados,
      };
      const commercialChanges = existingCommercial ? compareFields(existingCommercial, desiredCommercial) : populatedFields(desiredCommercial);

      if (!existing) summary.created++;
      else if (Object.keys(clientChanges).length > 0) summary.updatedClients++;
      if (!existingCommercial) summary.createdCommercial++;
      else if (Object.keys(commercialChanges).length > 0) summary.updatedCommercial++;
      if (existing && Object.keys(clientChanges).length === 0 && Object.keys(commercialChanges).length === 0) summary.unchanged++;
      for (const field of Object.keys(clientChanges)) summary.fieldChanges[field] = (summary.fieldChanges[field] ?? 0) + 1;
      for (const field of Object.keys(commercialChanges)) summary.fieldChanges[`comercial.${field}`] = (summary.fieldChanges[`comercial.${field}`] ?? 0) + 1;

      actions.push({
        source,
        existing,
        clientChanges,
        desiredClient,
        desiredCommercial,
        hasCommercialChanges: !existingCommercial || Object.keys(commercialChanges).length > 0,
      });
    }

    if (apply) {
      await connection.beginTransaction();
      try {
        for (const action of actions) {
          let clientId = action.existing ? Number(action.existing.id) : null;
          if (!clientId) {
            const [result] = await connection.execute(
              "INSERT INTO clientes (cnpj, razaoSocial, nomeContato, telefone, email, ativo) VALUES (?, ?, ?, ?, ?, 1)",
              [formatCnpj(action.source.cnpj), action.desiredClient.razaoSocial, action.desiredClient.nomeContato, action.desiredClient.telefone, action.desiredClient.email]
            );
            clientId = result.insertId;
          } else if (Object.keys(action.clientChanges).length > 0) {
            const fields = Object.keys(action.clientChanges);
            const values = fields.map((field) => action.desiredClient[field]);
            await connection.execute(
              `UPDATE clientes SET ${fields.map((field) => `\`${field}\` = ?`).join(", ")} WHERE id = ?`,
              [...values, clientId]
            );
          }

          if (!action.hasCommercialChanges && action.existing) continue;
          await connection.execute(
            `INSERT INTO cliente_dados_comerciais
              (clienteId, grupo, classificacao, situacaoBase, situacaoOnvio, contatoPrimario, emailPrimario, contatoSecundario, emailSecundario, servicosUtilizados, arquivoOrigem, linhaOrigem, atualizadoOrigemEm)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
               grupo = VALUES(grupo), classificacao = VALUES(classificacao), situacaoBase = VALUES(situacaoBase), situacaoOnvio = VALUES(situacaoOnvio),
               contatoPrimario = VALUES(contatoPrimario), emailPrimario = VALUES(emailPrimario), contatoSecundario = VALUES(contatoSecundario), emailSecundario = VALUES(emailSecundario),
               servicosUtilizados = VALUES(servicosUtilizados), arquivoOrigem = VALUES(arquivoOrigem), linhaOrigem = VALUES(linhaOrigem), atualizadoOrigemEm = NOW()`,
            [
              clientId,
              action.desiredCommercial.grupo,
              action.desiredCommercial.classificacao,
              action.desiredCommercial.situacaoBase,
              action.desiredCommercial.situacaoOnvio,
              action.desiredCommercial.contatoPrimario,
              action.desiredCommercial.emailPrimario,
              action.desiredCommercial.contatoSecundario,
              action.desiredCommercial.emailSecundario,
              action.desiredCommercial.servicosUtilizados,
              path.basename(sourceFile),
              action.source.rowNumber,
            ]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }

    prepareOutputDirectory(reportFile);
    prepareOutputDirectory(exceptionsFile);
    fs.writeFileSync(reportFile, reportMarkdown(summary, exceptions), "utf8");
    const csvLines = ["tipo;linha;cnpj;empresa;detalhe"];
    for (const exception of exceptions) {
      csvLines.push([exception.type, exception.line, exception.cnpj, exception.empresa, exception.detail].map(csvEscape).join(";"));
    }
    fs.writeFileSync(exceptionsFile, `${csvLines.join("\n")}\n`, "utf8");

    console.log(JSON.stringify({ summary, reportFile, exceptionsFile, exceptionCount: exceptions.length }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
