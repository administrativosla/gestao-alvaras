importScripts("protocol.js");
const RECEITA_URL = "https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj";
const { CHANNEL, isPortalUrl, isReceitaUrl, isBoundPortalUrl, validStartPayload } = globalThis.MJPCndProtocol;

async function getPortalOrigin() {
  const { portalOrigin } = await chrome.storage.local.get("portalOrigin");
  return portalOrigin || null;
}

async function sendPortalEvent(job, eventType, payload = {}) {
  if (!job?.portalTabId) return;
  try {
    await chrome.tabs.sendMessage(job.portalTabId, {
      channel: CHANNEL,
      type: "PORTAL_EVENT",
      eventType,
      payload: { ...payload, job: job.publicJob },
    });
  } catch {
    // A página pode ter sido fechada; a tentativa permanece no histórico.
  }
}

async function findOrCreateReceitaTab() {
  const tabs = await chrome.tabs.query({ url: "https://servicos.receitafederal.gov.br/servico/certidoes/*" });
  if (tabs[0]?.id) {
    await chrome.tabs.update(tabs[0].id, { active: true, url: RECEITA_URL });
    return tabs[0].id;
  }
  const tab = await chrome.tabs.create({ url: RECEITA_URL, active: true });
  return tab.id;
}

async function handlePortalCommand(command, sender) {
  const portalOrigin = await getPortalOrigin();
  if (!sender.tab?.id || !isBoundPortalUrl(sender.tab.url || "", portalOrigin)) return;

  if (command.type === "CND_PING") {
    await chrome.tabs.sendMessage(sender.tab.id, { channel: CHANNEL, type: "EXTENSION_READY" });
    return;
  }

  if (command.type === "CND_STOP") {
    const { activeCndJob } = await chrome.storage.session.get("activeCndJob");
    if (activeCndJob?.publicJob?.requestId !== command.requestId) return;
    if (activeCndJob.receitaTabId) {
      chrome.tabs.sendMessage(activeCndJob.receitaTabId, { channel: CHANNEL, type: "RFB_STOP", requestId: command.requestId }).catch(() => undefined);
    }
    await chrome.storage.session.remove("activeCndJob");
    return;
  }

  if (command.type !== "CND_START" || !validStartPayload(command.payload)) return;
  const publicJob = {
    requestId: command.payload.requestId,
    consultaId: command.payload.consultaId,
    clienteId: command.payload.clienteId,
    cnpj: command.payload.cnpj.replace(/\D/g, ""),
    origem: command.payload.origem,
  };
  const job = { publicJob, portalTabId: sender.tab.id, startedAt: Date.now() };
  await chrome.storage.session.set({ activeCndJob: job });
  await sendPortalEvent(job, "CND_PROGRESS", { message: "Abrindo o portal oficial da Receita." });
  const tabId = await findOrCreateReceitaTab();
  await chrome.storage.session.set({ activeCndJob: { ...job, receitaTabId: tabId } });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.channel !== CHANNEL) return false;

  if (message.type === "GET_BINDING") {
    getPortalOrigin().then((portalOrigin) => sendResponse({ portalOrigin }));
    return true;
  }

  if (message.type === "BIND_PORTAL") {
    if (!isPortalUrl(message.portalUrl || "")) {
      sendResponse({ ok: false, error: "Abra o Gestor de Certidões antes de vincular." });
      return false;
    }
    const portalOrigin = new URL(message.portalUrl).origin;
    chrome.storage.local.set({ portalOrigin }).then(() => sendResponse({ ok: true, portalOrigin }));
    return true;
  }

  if (message.type === "PORTAL_COMMAND") {
    handlePortalCommand(message.command, sender).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "RFB_READY" && sender.tab?.id && isReceitaUrl(sender.tab.url || "")) {
    chrome.storage.session.get("activeCndJob").then(({ activeCndJob }) => {
      if (!activeCndJob) return;
      chrome.tabs.sendMessage(sender.tab.id, { channel: CHANNEL, type: "RFB_EXECUTE", job: activeCndJob.publicJob }).catch(() => undefined);
    });
    return false;
  }

  if (message.type === "RFB_EVENT" && sender.tab?.id && isReceitaUrl(sender.tab.url || "")) {
    chrome.storage.session.get("activeCndJob").then(async ({ activeCndJob }) => {
      if (!activeCndJob || activeCndJob.publicJob.requestId !== message.requestId) return;
      await sendPortalEvent(activeCndJob, message.eventType, message.payload);
      if (["CND_COMPLETE", "CND_UNAVAILABLE", "CND_ERROR"].includes(message.eventType)) {
        await chrome.storage.session.remove("activeCndJob");
      }
    });
    return false;
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !isReceitaUrl(tab.url || "")) return;
  chrome.storage.session.get("activeCndJob").then(({ activeCndJob }) => {
    if (!activeCndJob) return;
    chrome.tabs.sendMessage(tabId, { channel: CHANNEL, type: "RFB_EXECUTE", job: activeCndJob.publicJob }).catch(() => undefined);
  });
});
