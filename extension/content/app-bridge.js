// Runs on Resume Butler's own pages. Lets the app see the extension is
// installed and hand it a token without copy and paste: the /extension page
// posts { source: "resume-butler-app", type: "connect", token } to its own
// origin, and this answers { source: "resume-butler-extension", type:
// "connected", ok } once the background worker has checked the token with the
// app. See src/features/extension/ConnectExtension.jsx.

document.documentElement.setAttribute("data-resume-butler-extension", chrome.runtime.getManifest().version);

window.addEventListener("message", (event) => {
  // Only the app's own page, never other frames or origins
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data;
  if (data?.source !== "resume-butler-app" || data.type !== "connect" || typeof data.token !== "string")
    return;

  chrome.runtime.sendMessage({ type: "connect", token: data.token }, (reply) => {
    const ok = !chrome.runtime.lastError && reply?.ok === true;
    window.postMessage({ source: "resume-butler-extension", type: "connected", ok }, window.location.origin);
  });
});
