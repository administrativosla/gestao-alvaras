import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Protocol = {
  isPortalUrl: (url: string) => boolean;
  isReceitaUrl: (url: string) => boolean;
  isBoundPortalUrl: (url: string, origin: string) => boolean;
  validStartPayload: (payload: unknown) => boolean;
  chooseValidCertificate: (data: unknown) => Record<string, unknown> | undefined;
  resultFromCertificate: (certificate: unknown) => "negativa" | "positiva_efeito_negativa";
  responseNeedsIssuance: (data: unknown) => boolean;
};

function carregarProtocolo(): Protocol {
  const source = readFileSync(resolve(process.cwd(), "chrome-extension/protocol.js"), "utf8");
  const sandbox: Record<string, unknown> = { URL };
  runInNewContext(source, sandbox);
  return (sandbox.MJPCndProtocol as Protocol);
}

const protocolo = carregarProtocolo();

describe("protocolo da extensão CND Federal", () => {
  it("aceita somente o Portal Controller em HTTPS e na rota de certidões", () => {
    expect(protocolo.isPortalUrl("https://portal-controller.manus.space/certidoes")).toBe(true);
    expect(protocolo.isPortalUrl("https://3000-exemplo.manus.computer/certidoes/clientes")).toBe(true);
    expect(protocolo.isPortalUrl("https://portal-controller.manus.space/clientes")).toBe(false);
    expect(protocolo.isPortalUrl("https://manus.space.evil.example/certidoes")).toBe(false);
    expect(protocolo.isPortalUrl("http://portal-controller.manus.space/certidoes")).toBe(false);
  });

  it("restringe a automação ao host e caminho oficiais da Receita", () => {
    expect(protocolo.isReceitaUrl("https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj")).toBe(true);
    expect(protocolo.isReceitaUrl("https://servicos.receitafederal.gov.br/outro")).toBe(false);
    expect(protocolo.isReceitaUrl("https://receitafederal.gov.br.evil.example/servico/certidoes/")).toBe(false);
  });

  it("aceita comandos somente da origem exata vinculada pelo operador", () => {
    expect(protocolo.isBoundPortalUrl(
      "https://portal-controller.manus.space/certidoes",
      "https://portal-controller.manus.space",
    )).toBe(true);
    expect(protocolo.isBoundPortalUrl(
      "https://outro-portal.manus.space/certidoes",
      "https://portal-controller.manus.space",
    )).toBe(false);
  });

  it("valida nonce, consulta, cliente, CNPJ e origem antes de executar", () => {
    const valido = {
      requestId: "550e8400-e29b-41d4-a716-446655440000",
      consultaId: 10,
      clienteId: 20,
      cnpj: "11.222.333/0001-81",
      origem: "consulta_anterior",
    };
    expect(protocolo.validStartPayload(valido)).toBe(true);
    expect(protocolo.validStartPayload({ ...valido, requestId: "curto" })).toBe(false);
    expect(protocolo.validStartPayload({ ...valido, cnpj: "123" })).toBe(false);
    expect(protocolo.validStartPayload({ ...valido, origem: "desconhecida" })).toBe(false);
  });

  it("seleciona somente certidão ativa/válida com segunda via", () => {
    const data = {
      certidoes: [
        { idCertidao: "expirada", situacao: "Expirada", hasSegundaVia: true },
        { idCertidao: "sem-pdf", situacao: "Válida", hasSegundaVia: false },
        { idCertidao: "valida", situacao: "Ativa", hasSegundaVia: true, tipoCertidao: "Negativa" },
      ],
    };
    expect(protocolo.chooseValidCertificate(data)?.idCertidao).toBe("valida");
    expect(protocolo.resultFromCertificate(data.certidoes[2])).toBe("negativa");
    expect(protocolo.resultFromCertificate({ tipoCertidao: "Positiva com efeitos de negativa" })).toBe("positiva_efeito_negativa");
  });

  it("encaminha lista sem versão válida ou mensagem equivalente para nova emissão", () => {
    expect(protocolo.responseNeedsIssuance({ certidoes: [] })).toBe(true);
    expect(protocolo.responseNeedsIssuance({ mensagem: { texto: "Certidão não encontrada" } })).toBe(true);
    expect(protocolo.responseNeedsIssuance({ mensagem: { texto: "Serviço temporariamente indisponível" } })).toBe(false);
  });

  it("mantém permissões mínimas no manifesto", () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "chrome-extension/manifest.json"), "utf8"));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions.sort()).toEqual(["storage", "tabs"]);
    expect(manifest.host_permissions).toEqual(["https://servicos.receitafederal.gov.br/servico/certidoes/*"]);
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
  });
});
