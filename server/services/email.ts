import nodemailer from "nodemailer";

// Configuração do transporter Gmail SMTP
// Usa Senha de App gerada pelo Google (não a senha normal da conta)
function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("Credenciais SMTP não configuradas. Verifique SMTP_USER e SMTP_PASS.");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // SSL
    auth: { user, pass },
  });
}

export interface AlertaEmailData {
  razaoSocial: string;
  cnpj: string;
  tipoAlvara: string;
  numeroAlvara: string | null;
  dataVencimento: Date;
  diasParaVencimento: number;
  statusAtual: string;
  alvaraId: number;
}

export interface NotificacaoStatusData {
  razaoSocial: string;
  cnpj: string;
  tipoAlvara: string;
  numeroAlvara: string | null;
  statusAnterior: string | null;
  statusNovo: string;
  responsavel: string;
  observacao: string | null;
  dataVencimento: Date;
}

/**
 * Envia e-mail de alerta de vencimento para uma lista de destinatários.
 */
export async function enviarAlertaVencimento(
  destinatarios: string[],
  dados: AlertaEmailData
): Promise<boolean> {
  if (!destinatarios || destinatarios.length === 0) return false;

  const transporter = createTransporter();
  const { razaoSocial, cnpj, tipoAlvara, numeroAlvara, dataVencimento, diasParaVencimento } = dados;

  const prazoTexto =
    diasParaVencimento === 0
      ? "VENCE HOJE"
      : diasParaVencimento < 0
        ? `VENCIDO HÁ ${Math.abs(diasParaVencimento)} DIA${Math.abs(diasParaVencimento) !== 1 ? "S" : ""}`
        : `vence em ${diasParaVencimento} dia${diasParaVencimento !== 1 ? "s" : ""}`;

  const urgencia =
    diasParaVencimento <= 3 ? "🔴 URGENTE" :
    diasParaVencimento <= 7 ? "🟠 ATENÇÃO" :
    diasParaVencimento <= 15 ? "🟡 AVISO" : "🟢 LEMBRETE";

  const dataFormatada = dataVencimento.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const assunto = `${urgencia} — Alvará de ${razaoSocial} ${prazoTexto}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerta de Vencimento de Alvará</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:#1e293b;padding:28px 32px;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663456310534/iXSjSksZZTmFkzRk.png" alt="MJP Controller" style="height:34px;width:auto;display:block;margin-bottom:8px;">
              <p style="margin:0;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Gestor de Alvarás · MJP Controller</p>
              <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:600;">Alerta de Vencimento</h1>
            </td>
          </tr>

          <!-- Urgência badge -->
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;
                background:${diasParaVencimento <= 3 ? '#fee2e2' : diasParaVencimento <= 7 ? '#ffedd5' : diasParaVencimento <= 15 ? '#fef9c3' : '#dcfce7'};
                color:${diasParaVencimento <= 3 ? '#b91c1c' : diasParaVencimento <= 7 ? '#c2410c' : diasParaVencimento <= 15 ? '#854d0e' : '#166534'};">
                ${urgencia} — ${prazoTexto.toUpperCase()}
              </div>
            </td>
          </tr>

          <!-- Dados do alvará -->
          <tr>
            <td style="padding:20px 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                <tr style="background:#f8fafc;">
                  <td colspan="2" style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Cliente</p>
                    <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1e293b;">${razaoSocial}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#64748b;">CNPJ: ${cnpj}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-right:1px solid #e2e8f0;width:50%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Tipo de Alvará</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;">${tipoAlvara}</p>
                  </td>
                  <td style="padding:12px 16px;width:50%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Número</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;">${numeroAlvara ?? "—"}</p>
                  </td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:12px 16px;border-right:1px solid #e2e8f0;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Data de Vencimento</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${diasParaVencimento <= 7 ? '#dc2626' : '#1e293b'};">${dataFormatada}</p>
                  </td>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Status Atual</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;">${dados.statusAtual}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Ação -->
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 16px;font-size:14px;color:#64748b;">
                Acesse o sistema para atualizar o status de renovação e registrar as providências tomadas.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Este é um e-mail automático gerado pelo sistema Gestor de Alvarás. Não responda a este e-mail.
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
      from: `"Gestão de Alvarás - MJP Controller" <${process.env.SMTP_USER}>`,
      to: destinatarios.join(", "),
      subject: assunto,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Email] Falha ao enviar alerta:", err);
    return false;
  }
}

/**
 * Envia e-mail de notificação de mudança de status para uma lista de destinatários.
 */
export async function enviarNotificacaoStatusAtualizado(
  destinatarios: string[],
  dados: NotificacaoStatusData
): Promise<boolean> {
  if (!destinatarios || destinatarios.length === 0) return false;

  const transporter = createTransporter();
  const {
    razaoSocial,
    cnpj,
    tipoAlvara,
    numeroAlvara,
    statusAnterior,
    statusNovo,
    responsavel,
    observacao,
    dataVencimento,
  } = dados;

  const dataVencFormatada = dataVencimento.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const dataHoraAcao = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusCorBg: Record<string, string> = {
    "Em Vigência": "#dcfce7",
    "Vencido": "#fee2e2",
    "Contato Realizado": "#dbeafe",
    "Tratativa Comercial": "#e0e7ff",
    "Documentação Solicitada": "#fef9c3",
    "Em Renovação": "#ffedd5",
    "Renovado": "#d1fae5",
    "Cancelado": "#f1f5f9",
  };
  const statusCorText: Record<string, string> = {
    "Em Vigência": "#166534",
    "Vencido": "#b91c1c",
    "Contato Realizado": "#1d4ed8",
    "Tratativa Comercial": "#3730a3",
    "Documentação Solicitada": "#854d0e",
    "Em Renovação": "#c2410c",
    "Renovado": "#065f46",
    "Cancelado": "#475569",
  };

  const bgNovo = statusCorBg[statusNovo] ?? "#f1f5f9";
  const textNovo = statusCorText[statusNovo] ?? "#1e293b";

  const assunto = `📋 Atualização de Status — ${razaoSocial} (${tipoAlvara})`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atualização de Status de Alvará</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1e293b;padding:28px 32px;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663456310534/iXSjSksZZTmFkzRk.png" alt="MJP Controller" style="height:34px;width:auto;display:block;margin-bottom:8px;">
              <p style="margin:0;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Gestor de Alvarás · MJP Controller</p>
              <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:600;">Atualização de Status</h1>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${dataHoraAcao}</p>
            </td>
          </tr>

          <!-- Mudança de status -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
                    ${statusAnterior ? `
                    <span style="padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;">
                      ${statusAnterior}
                    </span>
                    <span style="font-size:18px;color:#94a3b8;margin:0 8px;">→</span>
                    ` : ""}
                    <span style="padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;background:${bgNovo};color:${textNovo};">
                      ${statusNovo}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Dados do alvará -->
          <tr>
            <td style="padding:20px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                <tr style="background:#f8fafc;">
                  <td colspan="2" style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Cliente</p>
                    <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1e293b;">${razaoSocial}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#64748b;">CNPJ: ${cnpj}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-right:1px solid #e2e8f0;width:50%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Tipo de Alvará</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;">${tipoAlvara}</p>
                  </td>
                  <td style="padding:12px 16px;width:50%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Número</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;">${numeroAlvara ?? "—"}</p>
                  </td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:12px 16px;border-right:1px solid #e2e8f0;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Vencimento</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;">${dataVencFormatada}</p>
                  </td>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Responsável</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:500;color:#1e293b;">${responsavel}</p>
                  </td>
                </tr>
                ${observacao ? `
                <tr>
                  <td colspan="2" style="padding:12px 16px;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Observação</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;">${observacao}</p>
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>

          <!-- Espaço -->
          <tr><td style="height:24px;"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Este é um e-mail automático gerado pelo sistema Gestor de Alvarás. Não responda a este e-mail.
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
      from: `"Gestão de Alvarás - MJP Controller" <${process.env.SMTP_USER}>`,
      to: destinatarios.join(", "),
      subject: assunto,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Email] Falha ao enviar notificação de status:", err);
    return false;
  }
}

/**
 * Envia e-mail de teste para validar as credenciais SMTP.
 */
export async function enviarEmailTeste(destinatario: string): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();

    // Verifica a conexão antes de enviar
    await transporter.verify();

    await transporter.sendMail({
      from: `"Gestão de Alvarás - MJP Controller" <${process.env.SMTP_USER}>`,
      to: destinatario,
      subject: "✅ Teste de Configuração — Gestor de Alvarás",
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:32px auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
          <h2 style="color:#1e293b;margin:0 0 8px;">✅ Configuração de e-mail funcionando!</h2>
          <p style="color:#64748b;margin:0 0 16px;">
            O sistema Gestor de Alvarás está corretamente configurado para enviar alertas automáticos de vencimento de alvarás.
          </p>
          <p style="color:#94a3b8;font-size:13px;margin:0;">
            Remetente: ${process.env.SMTP_USER}<br>
            Data/hora do teste: ${new Date().toLocaleString("pt-BR")}
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Erro desconhecido" };
  }
}

export interface ConviteEmailData {
  roleLabel: string;
  linkAcesso: string;
  convidadoPorNome: string;
  expiresAt: Date;
}

/**
 * Envia e-mail de convite para um novo usuário acessar o Gestor de Alvarás.
 */
export async function enviarConviteUsuario(
  destinatario: string,
  dados: ConviteEmailData
): Promise<boolean> {
  try {
    const transporter = createTransporter();
    const { roleLabel, linkAcesso, convidadoPorNome, expiresAt } = dados;

    const expiresFormatada = expiresAt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const assunto = `🔑 Você foi convidado para o Gestor de Alvarás`;

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite — Gestor de Alvarás</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663456310534/iXSjSksZZTmFkzRk.png" alt="MJP Controller" style="height:40px;width:auto;display:block;margin:0 auto 6px;">
            </div>
            <p style="color:#94a3b8;font-size:13px;margin:8px 0 0;">Sistema de Controle de Alvarás de Funcionamento</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h2 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 12px;">Você foi convidado!</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
              <strong>${convidadoPorNome}</strong> convidou você para acessar o <strong>Gestor de Alvarás</strong> como <strong>${roleLabel}</strong>.
            </p>

            <!-- Nível de acesso -->
            <div style="background:#f1f5f9;border-radius:8px;padding:16px 20px;margin:0 0 28px;">
              <p style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">Seu nível de acesso</p>
              <p style="color:#1e293b;font-size:16px;font-weight:700;margin:0;">🏷️ ${roleLabel}</p>
            </div>

            <!-- Instruções -->
            <div style="border-left:3px solid #3b82f6;padding:12px 16px;background:#eff6ff;border-radius:0 8px 8px 0;margin:0 0 28px;">
              <p style="color:#1e40af;font-size:14px;font-weight:600;margin:0 0 8px;">Como acessar:</p>
              <ol style="color:#1e40af;font-size:14px;margin:0;padding-left:20px;line-height:1.8;">
                <li>Clique no botão abaixo para abrir o sistema</li>
                <li>Faça login com sua conta Manus</li>
                <li>Aguarde a aprovação do administrador</li>
                <li>Após aprovado, você terá acesso completo como <strong>${roleLabel}</strong></li>
              </ol>
            </div>

            <!-- CTA Button -->
            <div style="text-align:center;margin:0 0 28px;">
              <a href="${linkAcesso}" style="display:inline-block;background:#1e293b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                Acessar o Gestor de Alvarás →
              </a>
            </div>

            <!-- Validade -->
            <p style="color:#94a3b8;font-size:13px;text-align:center;margin:0;">
              Este convite é válido até <strong>${expiresFormatada}</strong>.<br>
              Após essa data, solicite um novo convite ao administrador.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">
              Gestor de Alvarás — MJP Controller<br>
              Se você não esperava este e-mail, pode ignorá-lo com segurança.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: `"Gestão de Alvarás - MJP Controller" <${process.env.SMTP_USER}>`,
      to: destinatario,
      subject: assunto,
      html,
    });

    return true;
  } catch (err: any) {
    console.error("[email] Erro ao enviar convite:", err?.message);
    return false;
  }
}
