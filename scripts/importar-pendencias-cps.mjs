import fs from "node:fs";
import mysql from "mysql2/promise";

const args = process.argv.slice(2);
const input = args[args.indexOf("--input") + 1];
const apply = args.includes("--apply");
const reportPath = args.includes("--report") ? args[args.indexOf("--report") + 1] : null;
if (!input) throw new Error("Uso: node scripts/importar-pendencias-cps.mjs --input <resposta-gws.json> [--apply] [--report <arquivo.md>]");

const STATUS = ["sem_contato", "cliente_contatado", "contato_sem_retorno", "fase_ajustes", "aprovacao_minuta", "links_enviados", "assinado_parcial", "assinado_total"];
const ORIGEM = "Controle de Pendências CPS — Página1";

function texto(value, max = 500) {
  const output = String(value ?? "").replace(/\s+/g, " ").trim();
  return output ? output.slice(0, max) : null;
}
function normalizar(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function cnpj(value) { return String(value ?? "").replace(/\D/g, "").padStart(14, "0"); }
function cnpjValido(value) {
  if (value.length !== 14 || /^([0-9])\1+$/.test(value)) return false;
  const digito = (digits, weights) => { const sum = digits.split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0); const rest = sum % 11; return rest < 2 ? "0" : String(11 - rest); };
  return digito(value.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]) === value[12] && digito(value.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]) === value[13];
}
function tipo(descricao) { const value = normalizar(descricao); return value.includes("cowork") || value.includes("endereco fiscal") ? "coworking" : "prestacao_servico"; }
function status(value) {
  const source = normalizar(value);
  if (!source) return "sem_contato";
  if (source.includes("contato sem retorno")) return "contato_sem_retorno";
  if (source.includes("link enviado")) return "links_enviados";
  if (source.includes("assinado")) return "assinado_parcial";
  if (source.includes("condicionou") || source.includes("aguardando revisao")) return "fase_ajustes";
  return "sem_contato";
}
function justificativa(statusOrigem) { return statusOrigem ? `Importação inicial. Status informado na origem: ${statusOrigem}.` : "Importação inicial sem andamento informado na planilha de origem."; }

const raw = JSON.parse(fs.readFileSync(input, "utf8"));
const values = raw.values ?? [];
const headers = (values[0] ?? []).map(normalizar);
const column = (...names) => headers.findIndex((header) => names.some((name) => header === normalizar(name)));
const nameIndex = column("Nome"); const clientIndex = column("Cliente"); const documentIndex = column("CNPJ/CPF", "CNPJ"); const statusIndex = column("STATUS", "Status");
if (nameIndex < 0 || clientIndex < 0 || documentIndex < 0) throw new Error("Colunas Nome, Cliente e CNPJ/CPF são obrigatórias.");

const source = [];
for (let i = 1; i < values.length; i++) {
  const row = values[i] ?? [];
  const description = texto(row[nameIndex]); const clientName = texto(row[clientIndex], 255); const document = cnpj(row[documentIndex]); const sourceStatus = statusIndex >= 0 ? texto(row[statusIndex]) : null;
  if (!description && !clientName && !document) continue;
  source.push({ line: i + 1, description, clientName: clientName ?? "Cliente não informado", document, sourceStatus, type: tipo(description), status: status(sourceStatus) });
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [clients] = await connection.query("SELECT id, cnpj FROM clientes WHERE ativo = 1");
  const clientByCnpj = new Map(clients.map((client) => [String(client.cnpj).replace(/\D/g, ""), client]));
  const summary = { lines: source.length, created: 0, refreshed: 0, exceptions: 0, invalid: 0, unmatched: 0, status: Object.fromEntries(STATUS.map((item) => [item, 0])), types: { prestacao_servico: 0, coworking: 0 } };
  const planned = [];
  for (const record of source) {
    if (!cnpjValido(record.document)) { planned.push({ kind: "exception", record, reason: "CNPJ inválido ou CPF não suportado para conciliação automática." }); summary.invalid++; continue; }
    const client = clientByCnpj.get(record.document);
    if (!client) { planned.push({ kind: "exception", record, reason: "CNPJ não localizado na base compartilhada de clientes." }); summary.unmatched++; continue; }
    planned.push({ kind: "matched", record, client }); summary.status[record.status]++; summary.types[record.type]++;
  }
  if (apply) {
    await connection.beginTransaction();
    try {
      for (const action of planned) {
        const record = action.record;
        if (action.kind === "exception") {
          await connection.query(
            `INSERT INTO pendencias_contrato_excecoes (documento, nomeClienteOrigem, descricaoOrigem, tipoSugerido, statusSugerido, statusOrigem, motivo, situacao, arquivoOrigem, linhaOrigem)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)
             ON DUPLICATE KEY UPDATE documento = VALUES(documento), nomeClienteOrigem = VALUES(nomeClienteOrigem), descricaoOrigem = VALUES(descricaoOrigem), tipoSugerido = VALUES(tipoSugerido), statusSugerido = VALUES(statusSugerido), statusOrigem = VALUES(statusOrigem), motivo = VALUES(motivo), situacao = 'pendente'`,
            [record.document, record.clientName, record.description, record.type, record.status, record.sourceStatus, action.reason, ORIGEM, record.line],
          );
          summary.exceptions++; continue;
        }
        const [existing] = await connection.query("SELECT id FROM pendencias_contrato WHERE clienteId = ? AND tipo = ? LIMIT 1", [action.client.id, record.type]);
        if (existing.length) {
          await connection.query("UPDATE pendencias_contrato SET descricaoOrigem = ?, arquivoOrigem = ?, linhaOrigem = ?, ativa = true WHERE id = ?", [record.description, ORIGEM, record.line, existing[0].id]);
          summary.refreshed++; continue;
        }
        const [created] = await connection.query(
          "INSERT INTO pendencias_contrato (clienteId, tipo, status, descricaoOrigem, arquivoOrigem, linhaOrigem, ativa) VALUES (?, ?, ?, ?, ?, ?, true)",
          [action.client.id, record.type, record.status, record.description, ORIGEM, record.line],
        );
        await connection.query(
          "INSERT INTO pendencias_contrato_historico (pendenciaId, clienteId, statusAnterior, statusNovo, tipoEvento, justificativa, usuarioNome) VALUES (?, ?, NULL, ?, 'importacao', ?, 'Importação inicial — Sistema')",
          [created.insertId, action.client.id, record.status, justificativa(record.sourceStatus)],
        );
        summary.created++;
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
  }
  const report = `# Carga inicial — Gestor de Pendências de Contrato\n\n- **Modo:** ${apply ? "Aplicado" : "Prévia"}\n- **Origem:** ${ORIGEM}\n- **Linhas processadas:** ${summary.lines}\n- **Pendências criadas:** ${summary.created}\n- **Pendências já existentes atualizadas somente na referência de origem:** ${summary.refreshed}\n- **Exceções preservadas:** ${summary.exceptions}\n- **CNPJs inválidos:** ${summary.invalid}\n- **CNPJs sem cliente na base:** ${summary.unmatched}\n\n## Tipos conciliados\n\n| Tipo | Quantidade |\n|---|---:|\n| Prestação de serviço | ${summary.types.prestacao_servico} |\n| Coworking | ${summary.types.coworking} |\n\n## Status iniciais\n\n${Object.entries(summary.status).map(([key, value]) => `- ${key}: ${value}`).join("\n")}\n\nTodos os itens de origem **ASSINADO** foram inseridos como **assinado_parcial**, conforme decisão aprovada. As exceções não criam clientes e seguem disponíveis no painel para vínculo manual ou exclusão justificada.\n`;
  if (reportPath) fs.writeFileSync(reportPath, report, "utf8");
  console.log(JSON.stringify(summary, null, 2));
} finally { await connection.end(); }
