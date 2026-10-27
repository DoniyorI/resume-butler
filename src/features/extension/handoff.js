// Talking to the browser extension from the app's pages, without copy and
// paste. The extension's content script on this site (extension/content/
// app-bridge.js) marks <html data-resume-butler-extension="<version>"> and
// answers same-origin postMessages:
//   { source: APP_SOURCE, type: "status" }          -> { type: "status", connected, email }
//   { source: APP_SOURCE, type: "connect", token }  -> { type: "connected", ok }
// When the extension has a fixed ID (NEXT_PUBLIC_EXTENSION_ID), connecting
// also works through externally_connectable.

const APP_SOURCE = "resume-butler-app";
const EXTENSION_SOURCE = "resume-butler-extension";
const REPLY_TIMEOUT_MS = 2500;
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

export function extensionInstalled() {
  return (
    typeof document !== "undefined" && document.documentElement.hasAttribute("data-resume-butler-extension")
  );
}

// The content script runs at document_start, but give it a moment on slow loads
export async function waitForExtension(timeoutMs = 1500) {
  const started = Date.now();
  while (!extensionInstalled() && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return extensionInstalled();
}

// Post a message to the content script; resolves to its reply of `replyType`, or null
function ask(message, replyType) {
  return new Promise((resolve) => {
    if (!extensionInstalled()) return resolve(null);
    const timer = setTimeout(() => finish(null), REPLY_TIMEOUT_MS);
    function onMessage(event) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source === EXTENSION_SOURCE && event.data?.type === replyType) finish(event.data);
    }
    function finish(reply) {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(reply);
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ source: APP_SOURCE, ...message }, window.location.origin);
  });
}

// { connected, email } from the extension, or null if it didn't answer
export function extensionStatus() {
  return ask({ type: "status" }, "status");
}

function viaExternalMessage(token) {
  return new Promise((resolve) => {
    // eslint-disable-next-line no-undef
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
    if (!EXTENSION_ID || !runtime?.sendMessage) return resolve(false);
    try {
      runtime.sendMessage(EXTENSION_ID, { type: "resume-butler:connect", token }, (reply) => {
        resolve(!runtime.lastError && reply?.ok === true);
      });
    } catch {
      resolve(false);
    }
  });
}

// Resolves to true if the extension took the token
export async function handToExtension(token) {
  const reply = await ask({ type: "connect", token }, "connected");
  return reply?.ok === true || (await viaExternalMessage(token));
}
