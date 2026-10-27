// Runs on Resume Butler's own pages. Lets the app see the extension is
// installed, ask whether it's connected, and hand it a token without copy and
// paste. The protocol is described in src/features/extension/handoff.js.

document.documentElement.setAttribute("data-resume-butler-extension", chrome.runtime.getManifest().version);

const reply = (message) =>
  window.postMessage({ source: "resume-butler-extension", ...message }, window.location.origin);

window.addEventListener("message", (event) => {
  // Only the app's own page, never other frames or origins
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data;
  if (data?.source !== "resume-butler-app") return;

  // Is the extension connected, and to which account? (never the token)
  if (data.type === "status") {
    chrome.runtime.sendMessage({ type: "connection-status" }, (status) => {
      const ok = !chrome.runtime.lastError && status;
      reply({ type: "status", connected: Boolean(ok && status.connected), email: ok ? status.email : "" });
    });
  } else if (data.type === "connect" && typeof data.token === "string") {
    chrome.runtime.sendMessage({ type: "connect", token: data.token }, (result) => {
      reply({ type: "connected", ok: !chrome.runtime.lastError && result?.ok === true });
    });
  }
});
