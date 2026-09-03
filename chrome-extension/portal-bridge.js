const { CHANNEL, PAGE_SOURCE, EXT_SOURCE } = globalThis.MJPCndProtocol;

function postToPage(type, payload = {}) {
  window.postMessage({ source: EXT_SOURCE, channel: CHANNEL, type, payload }, window.location.origin);
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const message = event.data;
  if (message?.source !== PAGE_SOURCE || message.channel !== CHANNEL) return;
  if (!["CND_PING", "CND_START", "CND_STOP"].includes(message.type)) return;

  chrome.runtime.sendMessage({ channel: CHANNEL, type: "PORTAL_COMMAND", command: message }).catch(() => {
    postToPage("EXTENSION_ERROR", { message: "A extensão não respondeu." });
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.channel !== CHANNEL) return;
  if (message.type === "EXTENSION_READY") postToPage("EXTENSION_READY");
  if (message.type === "PORTAL_EVENT") postToPage(message.eventType, message.payload);
});
