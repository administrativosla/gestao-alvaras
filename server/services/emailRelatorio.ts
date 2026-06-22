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

export interface ItemRelatorio {
  razaoSocial: string;
  cnpj: string;
  tipoAlvara: string;
  numeroAlvara: string | null;
  dataVencimento: Date;
  diasParaVencimento: number; // negativo = vencido
  status: string;
  alvaraId: number;
}

export interface RelatorioEmailData {
  vencidos: ItemRelatorio[];
  aVencer: ItemRelatorio[]; // próximos 30 dias
  dataRelatorio: Date;
}

function formatarData(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function rowVencido(item: ItemRelatorio): string {
  const diasTexto = `Vencido há ${Math.abs(item.diasParaVencimento)} dia${Math.abs(item.diasParaVencimento) !== 1 ? "s" : ""}`;
  return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;font-size:13px;color:#1e293b;font-weight:500;">${item.razaoSocial}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;font-size:12px;color:#64748b;">${item.cnpj}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;font-size:12px;color:#64748b;">${item.tipoAlvara}${item.numeroAlvara ? ` · Nº ${item.numeroAlvara}` : ""}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;font-size:12px;color:#dc2626;font-weight:600;">${formatarData(item.dataVencimento)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;font-size:12px;color:#dc2626;">${diasTexto}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;font-size:12px;">
        <span style="padding:2px 8px;border-radius:12px;background:#fee2e2;color:#b91c1c;font-weight:500;">${item.status}</span>
      </td>
    </tr>`;
}

function rowAVencer(item: ItemRelatorio): string {
  const diasTexto =
    item.diasParaVencimento === 0
      ? "Vence hoje"
      : `Em ${item.diasParaVencimento} dia${item.diasParaVencimento !== 1 ? "s" : ""}`;
  const urgColor =
    item.diasParaVencimento <= 7
      ? "#dc2626"
      : item.diasParaVencimento <= 15
        ? "#d97706"
        : "#ca8a04";
  const urgBg =
    item.diasParaVencimento <= 7
      ? "#fee2e2"
      : item.diasParaVencimento <= 15
        ? "#ffedd5"
        : "#fef9c3";
  return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;font-weight:500;">${item.razaoSocial}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${item.cnpj}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${item.tipoAlvara}${item.numeroAlvara ? ` · Nº ${item.numeroAlvara}` : ""}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#1e293b;font-weight:500;">${formatarData(item.dataVencimento)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:${urgColor};font-weight:600;">${diasTexto}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;">
        <span style="padding:2px 8px;border-radius:12px;background:${urgBg};color:${urgColor};font-weight:500;">${item.status}</span>
      </td>
    </tr>`;
}

function tabelaVencidos(itens: ItemRelatorio[]): string {
  if (itens.length === 0) {
    return `<p style="font-size:13px;color:#16a34a;padding:16px 0;margin:0;">✅ Nenhum alvará vencido no momento.</p>`;
  }
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #fee2e2;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#fef2f2;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #fee2e2;">Empresa</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #fee2e2;">CNPJ</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #fee2e2;">Tipo / Nº</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #fee2e2;">Vencimento</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #fee2e2;">Situação</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #fee2e2;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${itens.map(rowVencido).join("")}
      </tbody>
    </table>`;
}

function tabelaAVencer(itens: ItemRelatorio[]): string {
  if (itens.length === 0) {
    return `<p style="font-size:13px;color:#16a34a;padding:16px 0;margin:0;">✅ Nenhum alvará a vencer nos próximos 30 dias.</p>`;
  }
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Empresa</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">CNPJ</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Tipo / Nº</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Vencimento</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Prazo</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${itens.map(rowAVencer).join("")}
      </tbody>
    </table>`;
}

export async function enviarRelatorioAlvaras(
  destinatarios: string[],
  dados: RelatorioEmailData
): Promise<boolean> {
  if (!destinatarios || destinatarios.length === 0) return false;

  let transporter: ReturnType<typeof createTransporter>;
  try {
    transporter = createTransporter();
  } catch (err) {
    console.error("[Email Relatório] Credenciais SMTP não configuradas:", err);
    return false;
  }

  const dataFormatada = formatarData(dados.dataRelatorio);
  const totalVencidos = dados.vencidos.length;
  const totalAVencer = dados.aVencer.length;

  const assunto = `📋 Relatório Diário de Alvarás — ${dataFormatada} (${totalVencidos} vencido${totalVencidos !== 1 ? "s" : ""}, ${totalAVencer} a vencer)`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Diário de Alvarás</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1e293b;padding:28px 32px;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">GestãoAlvarás · Relatório Automático</p>
              <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:600;">Relatório Diário de Alvarás</h1>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${dataFormatada} · Gerado automaticamente às 13h</p>
            </td>
          </tr>

          <!-- Resumo -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding-right:8px;">
                    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;text-align:center;">
                      <p style="margin:0;font-size:28px;font-weight:700;color:#dc2626;">${totalVencidos}</p>
                      <p style="margin:4px 0 0;font-size:12px;color:#b91c1c;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Alvarás Vencidos</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#ef4444;">Requerem renovação imediata</p>
                    </div>
                  </td>
                  <td width="50%" style="padding-left:8px;">
                    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;text-align:center;">
                      <p style="margin:0;font-size:28px;font-weight:700;color:#d97706;">${totalAVencer}</p>
                      <p style="margin:4px 0 0;font-size:12px;color:#b45309;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">A Vencer em 30 dias</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#f59e0b;">Iniciar processo de renovação</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Seção: Alvarás Vencidos -->
          <tr>
            <td style="padding:28px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div style="width:4px;height:20px;background:#dc2626;border-radius:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></div>
                      <span style="font-size:15px;font-weight:700;color:#1e293b;vertical-align:middle;">🔴 Alvarás Vencidos</span>
                      <span style="margin-left:8px;padding:2px 10px;border-radius:12px;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:600;">${totalVencidos}</span>
                    </div>
                    <p style="margin:6px 0 0;font-size:12px;color:#64748b;">Alvarás com data de vencimento ultrapassada que ainda não foram renovados ou cancelados.</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    ${tabelaVencidos(dados.vencidos)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Seção: A Vencer -->
          <tr>
            <td style="padding:28px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:12px;">
                    <div>
                      <div style="width:4px;height:20px;background:#d97706;border-radius:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></div>
                      <span style="font-size:15px;font-weight:700;color:#1e293b;vertical-align:middle;">🟡 A Vencer nos Próximos 30 Dias</span>
                      <span style="margin-left:8px;padding:2px 10px;border-radius:12px;background:#fef9c3;color:#854d0e;font-size:12px;font-weight:600;">${totalAVencer}</span>
                    </div>
                    <p style="margin:6px 0 0;font-size:12px;color:#64748b;">Alvarás que vencem nos próximos 30 dias e precisam de atenção para iniciar o processo de renovação.</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    ${tabelaAVencer(dados.aVencer)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Espaço -->
          <tr><td style="height:32px;"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Este é um relatório automático gerado diariamente pelo sistema GestãoAlvarás. Acesse o sistema para atualizar os status e registrar as providências. Não responda a este e-mail.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"GestãoAlvarás" <${process.env.SMTP_USER}>`,
      to: destinatarios.join(", "),
      subject: assunto,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Email] Falha ao enviar relatório diário:", err);
    return false;
  }
}
