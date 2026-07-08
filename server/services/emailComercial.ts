import nodemailer from "nodemailer";

function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new Error("Credenciais SMTP não configuradas.");
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

export interface ClienteSemRegistro {
  id: number;
  razaoSocial: string;
  cnpj: string;
  nomeFantasia?: string | null;
  municipio?: string | null;
  cidade?: string | null;
  estado?: string | null;
  uf?: string | null;
  nomeContato?: string | null;
  telefone?: string | null;
  email?: string | null;
}

function formatCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14) return raw.trim();
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function buildEmailHtml(clientes: ClienteSemRegistro[]): string {
  const dataHoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const rows = clientes
    .map(
      (c, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;font-weight:500;">${c.razaoSocial}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;font-family:monospace;">${formatCnpj(c.cnpj)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${c.nomeFantasia ?? "—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${c.municipio ?? c.cidade ?? "—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${c.estado ?? c.uf ?? "—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${c.nomeContato ?? "—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${c.telefone ?? "—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${c.email ?? "—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">
        <span style="padding:3px 10px;border-radius:12px;background:#ede9fe;color:#7c3aed;font-size:11px;font-weight:600;">Sem Registro</span>
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:900px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Cabeçalho -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;font-weight:600;">MJP Controller</p>
                  <h1 style="margin:4px 0 0;font-size:22px;color:#ffffff;font-weight:700;">Gestão de Alvarás</h1>
                  <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Painel Comercial — Clientes Sem Registro de Alvará</p>
                </td>
                <td align="right">
                  <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:10px 16px;text-align:center;">
                    <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">${clientes.length}</p>
                    <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.8);">Clientes</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Alerta informativo -->
        <tr>
          <td style="padding:20px 32px 0;">
            <div style="background:#ede9fe;border-left:4px solid #7c3aed;border-radius:6px;padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#4c1d95;font-weight:600;">⚠️ Oportunidade Comercial</p>
              <p style="margin:6px 0 0;font-size:13px;color:#5b21b6;">
                Os <strong>${clientes.length} clientes</strong> listados abaixo não possuem nenhum alvará ou CLI registrado no sistema.
                Esta lista foi gerada em <strong>${dataHoje}</strong> e representa uma oportunidade de prospecção ativa.
              </p>
            </div>
          </td>
        </tr>

        <!-- Tabela de clientes -->
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Razão Social</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">CNPJ</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Nome Fantasia</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Município</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">UF</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Contato</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Telefone</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">E-mail</th>
                  <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Relatório gerado automaticamente pelo <strong>Gestor de Alvarás — MJP Controller</strong> em ${dataHoje}.<br>
              Este e-mail é destinado ao time comercial para acompanhamento e prospecção.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function enviarEmailComercialSemRegistro(
  destinatarios: string[],
  clientes: ClienteSemRegistro[]
): Promise<void> {
  const transporter = createTransporter();
  const html = buildEmailHtml(clientes);
  const dataHoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  await transporter.sendMail({
    from: `"Gestão de Alvarás - MJP Controller" <${process.env.SMTP_USER}>`,
    to: destinatarios.join(", "),
    subject: `[Comercial] ${clientes.length} Clientes Sem Registro de Alvará — ${dataHoje}`,
    html,
  });
}
