(() => {
  const SOURCE = "mjp-rfb-interceptor";
  const COMMAND_SOURCE = "mjp-rfb-automation";
  const originalFetch = window.fetch.bind(window);
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  function publish(url, status, data) {
    if (!String(url).includes("/api/consulta")) return;
    window.postMessage({ source: SOURCE, type: "RFB_API_RESPONSE", payload: { url: String(url), status, data } }, window.location.origin);
  }

  async function parseResponse(response) {
    try { return await response.clone().json(); } catch { return null; }
  }

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
    parseResponse(response).then((data) => data && publish(url, response.status, data));
    return response;
  };

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__mjpUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener("load", () => {
      if (!String(this.__mjpUrl || "").includes("/api/consulta")) return;
      try {
        const data = typeof this.response === "object" && this.response !== null
          ? this.response
          : JSON.parse(this.responseText);
        publish(this.__mjpUrl, this.status, data);
      } catch {
        // Resposta não estruturada; o conteúdo não é encaminhado.
      }
    }, { once: true });
    return originalSend.apply(this, args);
  };

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (message?.source !== COMMAND_SOURCE || message.type !== "FETCH_SEGUNDA_VIA") return;
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(String(message.idCertidao))) return;
    const url = new URL(`api/consulta/seg-via/${message.idCertidao}`, `${window.location.origin}/servico/certidoes/`).toString();
    try {
      const response = await originalFetch(url, { credentials: "include", headers: { Accept: "application/json" } });
      const data = await parseResponse(response);
      publish(url, response.status, data);
    } catch (error) {
      publish(url, 0, { mensagem: { texto: error instanceof Error ? error.message : "Falha ao obter a segunda via." } });
    }
  });
})();
