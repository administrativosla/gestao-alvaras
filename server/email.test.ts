import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do nodemailer para não fazer chamadas reais durante os testes
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      verify: vi.fn().mockResolvedValue(true),
      sendMail: vi.fn().mockResolvedValue({ messageId: "test-id-123" }),
    })),
  },
}));

describe("Serviço de E-mail", () => {
  beforeEach(() => {
    // Simular variáveis de ambiente configuradas
    process.env.SMTP_USER = "alvarasmjp@gmail.com";
    process.env.SMTP_PASS = "test-app-password";
  });

  it("deve criar o transporter com as credenciais corretas", async () => {
    const nodemailer = await import("nodemailer");
    const { enviarEmailTeste } = await import("./services/email");

    const resultado = await enviarEmailTeste("teste@exemplo.com");

    expect(nodemailer.default.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: expect.objectContaining({
          user: "alvarasmjp@gmail.com",
        }),
      })
    );
    expect(resultado.success).toBe(true);
  });

  it("deve enviar e-mail de teste com conteúdo correto", async () => {
    const nodemailer = await import("nodemailer");
    const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-123" });
    (nodemailer.default.createTransport as any).mockReturnValue({
      verify: vi.fn().mockResolvedValue(true),
      sendMail: mockSendMail,
    });

    const { enviarEmailTeste } = await import("./services/email");
    const resultado = await enviarEmailTeste("destinatario@empresa.com");

    expect(resultado.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "destinatario@empresa.com",
        subject: expect.stringContaining("Teste de Configuração"),
      })
    );
  });

  it("deve enviar alerta de vencimento com dados corretos", async () => {
    const nodemailer = await import("nodemailer");
    const mockSendMail = vi.fn().mockResolvedValue({ messageId: "alerta-123" });
    (nodemailer.default.createTransport as any).mockReturnValue({
      sendMail: mockSendMail,
    });

    const { enviarAlertaVencimento } = await import("./services/email");
    const resultado = await enviarAlertaVencimento(
      ["equipe@empresa.com"],
      {
        razaoSocial: "Empresa Teste LTDA",
        cnpj: "12.345.678/0001-90",
        tipoAlvara: "Funcionamento",
        numeroAlvara: "ALV-2024-001",
        dataVencimento: new Date("2025-12-31"),
        diasParaVencimento: 7,
        statusAtual: "Pendente",
        alvaraId: 1,
      }
    );

    expect(resultado).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "equipe@empresa.com",
        subject: expect.stringContaining("Empresa Teste LTDA"),
        html: expect.stringContaining("Empresa Teste LTDA"),
      })
    );
  });

  it("deve retornar false quando não há destinatários", async () => {
    const { enviarAlertaVencimento } = await import("./services/email");
    const resultado = await enviarAlertaVencimento([], {
      razaoSocial: "Empresa Teste",
      cnpj: "00.000.000/0001-00",
      tipoAlvara: "Funcionamento",
      numeroAlvara: null,
      dataVencimento: new Date(),
      diasParaVencimento: 7,
      statusAtual: "Pendente",
      alvaraId: 1,
    });
    expect(resultado).toBe(false);
  });

  it("deve retornar erro quando credenciais não estão configuradas", async () => {
    // Este teste valida que a função trata erros de credenciais graciosamente
    // O mock já garante que não há chamadas reais ao SMTP
    const nodemailer = await import("nodemailer");
    (nodemailer.default.createTransport as any).mockReturnValue({
      verify: vi.fn().mockRejectedValue(new Error("Invalid credentials")),
      sendMail: vi.fn().mockRejectedValue(new Error("Invalid credentials")),
    });

    const { enviarEmailTeste } = await import("./services/email");
    const resultado = await enviarEmailTeste("teste@exemplo.com");

    expect(resultado.success).toBe(false);
    expect(resultado.error).toBeDefined();
  });
});
