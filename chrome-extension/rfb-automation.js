const { CHANNEL, normalizeText, chooseValidCertificate, resultFromCertificate, responseNeedsIssuance } = globalThis.MJPCndProtocol;
const INTERCEPTOR_SOURCE = "mjp-rfb-interceptor";
const COMMAND_SOURCE = "mjp-rfb-automation";
let activeJob = null;
let submittedInitial = false;
let submittedPeriod = false;
let captchaNotified = false;
let selectedCertificate = null;

function notify(eventType, payload = {}) {
  if (!activeJob) return;
  chrome.runtime.sendMessage({ channel: CHANNEL, type: "RFB_EVENT", requestId: activeJob.requestId, eventType, payload }).catch(() => undefined);
}

function deepElements(root = document) {
  const result = [];
  for (const element of root.querySelectorAll("*")) {
    result.push(element);
    if (element.shadowRoot) result.push(...deepElements(element.shadowRoot));
  }
  return result;
}

function setNativeValue(input, value) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
}

function findButton(label) {
  const normalized = normalizeText(label);
  return deepElements().find((element) => element instanceof HTMLButtonElement && normalizeText(element.textContent) === normalized);
}

function fillCnpj() {
  const input = deepElements().find((element) => element instanceof HTMLInputElement && element.name === "niContribuinte");
  if (!input) return false;
  setNativeValue(input, activeJob.cnpj);
  return true;
}

function visibleCaptcha() {
  return deepElements().some((element) => {
    if (!(element instanceof HTMLIFrameElement) || !String(element.src).includes("hcaptcha")) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 200 && rect.height > 100 && style.visibility !== "hidden" && style.display !== "none";
  });
}

function runStep() {
  if (!activeJob) return;
  if (visibleCaptcha() && !captchaNotified) {
    captchaNotified = true;
    notify("CND_NEEDS_HUMAN", { message: "A Receita apresentou um desafio hCaptcha. Conclua somente o desafio; a automação continuará em seguida." });
  }

  const route = window.location.hash;
  if (/\/home\/cnpj\/?$/.test(route) && !submittedInitial) {
    if (!fillCnpj()) return;
    const action = activeJob.origem === "nova_emissao_assistida" ? "Emitir Certidão" : "Consultar Certidão";
    const button = findButton(action);
    if (!button) return;
    submittedInitial = true;
    button.click();
    notify("CND_PROGRESS", { message: activeJob.origem === "consulta_anterior" ? "CNPJ preenchido; consultando certidões emitidas." : "CNPJ preenchido; nova emissão iniciada." });
    if (activeJob.origem === "nova_emissao_assistida") {
      notify("CND_NEEDS_HUMAN", { message: "Nova emissão iniciada. Conclua eventual hCaptcha no portal oficial; depois registre o documento no Portal Controller." });
    }
  }

  if (/\/home\/cnpj\/consultar\/?$/.test(route) && !submittedPeriod) {
    const button = findButton("Consultar Certidão");
    if (!button) return;
    submittedPeriod = true;
    button.click();
    notify("CND_PROGRESS", { message: "Pesquisando certidões emitidas nos últimos 12 meses." });
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin || event.data?.source !== INTERCEPTOR_SOURCE) return;
  const { url, status, data } = event.data.payload || {};
  if (!activeJob || !String(url).includes("/api/consulta")) return;

  if (String(url).includes("/seg-via/")) {
    if (status >= 200 && status < 300 && data?.pdf) {
      notify("CND_COMPLETE", {
        result: resultFromCertificate(selectedCertificate),
        message: data?.mensagem?.texto || "Segunda via recuperada automaticamente.",
        pdfBase64: data.pdf,
        fileName: `CND-Federal-${activeJob.cnpj}.pdf`,
        validadeAte: selectedCertificate?.dataValidade?.slice?.(0, 10) || null,
      });
    } else {
      notify("CND_ERROR", { message: data?.mensagem?.texto || "Não foi possível baixar a segunda via." });
    }
    return;
  }

  if (String(url).endsWith("/api/consulta") || String(url).endsWith("api/consulta")) {
    selectedCertificate = chooseValidCertificate(data);
    if (selectedCertificate?.idCertidao) {
      notify("CND_PROGRESS", { message: "Certidão válida localizada; baixando a segunda via." });
      window.postMessage({ source: COMMAND_SOURCE, type: "FETCH_SEGUNDA_VIA", idCertidao: String(selectedCertificate.idCertidao) }, window.location.origin);
      return;
    }
    if (responseNeedsIssuance(data)) {
      notify("CND_NEEDS_ISSUANCE", { message: data?.mensagem?.texto || "Nenhuma certidão válida com segunda via foi localizada." });
    } else {
      notify(status === 0 || status >= 500 ? "CND_UNAVAILABLE" : "CND_ERROR", { message: data?.mensagem?.texto || "A Receita não concluiu a consulta." });
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.channel !== CHANNEL) return;
  if (message.type === "RFB_STOP" && activeJob?.requestId === message.requestId) {
    activeJob = null;
    return;
  }
  if (message.type !== "RFB_EXECUTE") return;
  if (!activeJob || activeJob.requestId !== message.job?.requestId) {
    submittedInitial = false;
    submittedPeriod = false;
    captchaNotified = false;
    selectedCertificate = null;
  }
  activeJob = message.job;
  runStep();
});

chrome.runtime.sendMessage({ channel: CHANNEL, type: "RFB_READY" }).catch(() => undefined);
setInterval(runStep, 800);
