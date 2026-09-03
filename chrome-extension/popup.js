const CHANNEL = "mjp-cnd-v1";
const statusElement = document.getElementById("status");
const bindButton = document.getElementById("bind");

function showBound(origin) {
  statusElement.textContent = `Vinculada a ${origin}`;
  statusElement.classList.add("ready");
  bindButton.textContent = "Atualizar vínculo para a página aberta";
}

chrome.runtime.sendMessage({ channel: CHANNEL, type: "GET_BINDING" }).then(({ portalOrigin }) => {
  if (portalOrigin) showBound(portalOrigin);
});

bindButton.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.runtime.sendMessage({ channel: CHANNEL, type: "BIND_PORTAL", portalUrl: tab?.url || "" });
  if (response?.ok) {
    showBound(response.portalOrigin);
    if (tab?.id) chrome.tabs.reload(tab.id);
  } else {
    statusElement.textContent = response?.error || "Não foi possível vincular.";
    statusElement.classList.remove("ready");
  }
});
