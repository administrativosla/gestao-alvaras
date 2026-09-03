(() => {
  const CHANNEL = "mjp-cnd-v1";
  const PAGE_SOURCE = "mjp-portal-controller";
  const EXT_SOURCE = "mjp-cnd-extension";

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isPortalUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return url.protocol === "https:" && /(^|\.)manus\.(space|computer)$/.test(url.hostname) && url.pathname.startsWith("/certidoes");
    } catch {
      return false;
    }
  }

  function isReceitaUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return url.protocol === "https:"
        && url.hostname === "servicos.receitafederal.gov.br"
        && url.pathname.startsWith("/servico/certidoes/");
    } catch {
      return false;
    }
  }

  function isBoundPortalUrl(rawUrl, boundOrigin) {
    if (!isPortalUrl(rawUrl) || typeof boundOrigin !== "string") return false;
    try {
      return new URL(rawUrl).origin === new URL(boundOrigin).origin;
    } catch {
      return false;
    }
  }

  function validStartPayload(payload) {
    return payload
      && typeof payload.requestId === "string"
      && /^[a-f0-9-]{16,80}$/i.test(payload.requestId)
      && Number.isInteger(payload.consultaId)
      && payload.consultaId > 0
      && Number.isInteger(payload.clienteId)
      && payload.clienteId > 0
      && typeof payload.cnpj === "string"
      && payload.cnpj.replace(/\D/g, "").length === 14
      && ["consulta_anterior", "nova_emissao_assistida"].includes(payload.origem);
  }

  function chooseValidCertificate(data) {
    const certificates = Array.isArray(data?.certidoes) ? data.certidoes : [];
    return certificates.find((certificate) => {
      const status = normalizeText(certificate.situacao);
      return certificate.hasSegundaVia
        && (status.includes("valida") || status.includes("ativa"))
        && !status.includes("expirada")
        && !status.includes("anulada")
        && !status.includes("cancelada");
    });
  }

  function resultFromCertificate(certificate) {
    return normalizeText(certificate?.tipoCertidao).includes("positiva")
      ? "positiva_efeito_negativa"
      : "negativa";
  }

  function responseNeedsIssuance(data) {
    const message = normalizeText(data?.mensagem?.texto);
    return Array.isArray(data?.certidoes)
      || message.includes("certidao nao encontrada")
      || message.includes("certidoes nao encontradas")
      || message.includes("nenhuma certidao");
  }

  globalThis.MJPCndProtocol = {
    CHANNEL,
    PAGE_SOURCE,
    EXT_SOURCE,
    normalizeText,
    isPortalUrl,
    isReceitaUrl,
    isBoundPortalUrl,
    validStartPayload,
    chooseValidCertificate,
    resultFromCertificate,
    responseNeedsIssuance,
  };
})();
