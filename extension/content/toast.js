// A small notice in the corner of the job site after an application is
// recorded: what was added, with Undo. Rendered in a shadow root so the
// site's CSS can't restyle it, and built with textContent only.

const TOAST_STYLE = `
  :host { all: initial; }
  .toast {
    position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
    width: min(360px, calc(100vw - 32px)); box-sizing: border-box;
    padding: 12px 14px; border-radius: 10px; background: #fff; color: #0f172a;
    border: 1px solid #d7e9e2; box-shadow: 0 8px 28px -8px rgba(15, 23, 42, .28);
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
  }
  .row { display: flex; align-items: flex-start; gap: 10px; }
  .dot { flex: none; width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: #559F87; }
  .dot.warn { background: #d97706; }
  .body { flex: 1; min-width: 0; }
  .title { font-weight: 600; }
  .detail { color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .actions { display: flex; gap: 6px; margin-top: 8px; }
  button {
    font: inherit; font-weight: 500; cursor: pointer; border-radius: 6px; padding: 4px 10px;
    border: 1px solid #cbd5e1; background: #fff; color: #0f172a;
  }
  button.primary { background: #559F87; border-color: #559F87; color: #fff; }
  button:focus-visible { outline: 2px solid #559F87; outline-offset: 2px; }
  .close { border: 0; padding: 0 4px; color: #64748b; font-size: 16px; line-height: 1; }
`;

const TOAST_MS = 12_000;
let toastHost = null;

function removeToast() {
  toastHost?.remove();
  toastHost = null;
}

/**
 * Show a notice. `actions`: [{ label, primary, onClick }]; an action's
 * onClick may return a message to show in place of the notice.
 */
function showToast({ title, detail, warn = false, actions = [] }) {
  removeToast();
  toastHost = document.createElement("div");
  const root = toastHost.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = TOAST_STYLE;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  const row = document.createElement("div");
  row.className = "row";
  const dot = document.createElement("span");
  dot.className = warn ? "dot warn" : "dot";
  const body = document.createElement("div");
  body.className = "body";
  const titleEl = document.createElement("div");
  titleEl.className = "title";
  titleEl.textContent = title;
  body.append(titleEl);
  if (detail) {
    const detailEl = document.createElement("div");
    detailEl.className = "detail";
    detailEl.textContent = detail;
    detailEl.title = detail;
    body.append(detailEl);
  }
  if (actions.length) {
    const actionsEl = document.createElement("div");
    actionsEl.className = "actions";
    for (const action of actions) {
      const button = document.createElement("button");
      button.textContent = action.label;
      if (action.primary) button.className = "primary";
      button.addEventListener("click", async () => {
        button.disabled = true;
        const next = await action.onClick();
        if (next) showToast(next);
        else removeToast();
      });
      actionsEl.append(button);
    }
    body.append(actionsEl);
  }
  const close = document.createElement("button");
  close.className = "close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";
  close.addEventListener("click", removeToast);

  row.append(dot, body, close);
  toast.append(row);
  root.append(style, toast);
  document.documentElement.append(toastHost);
  const host = toastHost;
  setTimeout(() => host === toastHost && removeToast(), TOAST_MS);
}

const sendToBackground = (message) =>
  new Promise((resolve) =>
    chrome.runtime.sendMessage(message, (reply) => resolve(chrome.runtime.lastError ? null : reply))
  );

// The notice for what the background worker did with a submitted application
globalThis.RB_showResult = function showResult(result, job) {
  const what = [job.role, job.company].filter(Boolean).join(" at ");
  switch (result?.status) {
    case "added":
      showToast({
        title: "Added to Resume Butler",
        detail: what,
        actions: [
          {
            label: "Undo",
            onClick: async () => {
              const reply = await sendToBackground({ type: "undo", id: result.application.id });
              return reply?.ok
                ? { title: "Removed from Resume Butler", detail: what }
                : {
                    title: "Couldn't undo",
                    detail: reply?.error || "Remove it in Resume Butler instead.",
                    warn: true,
                  };
            },
          },
        ],
      });
      break;
    case "updated":
      showToast({
        title: "Already in Resume Butler",
        detail: `${what}, updated with this posting's details`,
      });
      break;
    case "queued":
      showToast({ title: "Saved for Resume Butler", detail: "It will be added when you're back online." });
      break;
    case "not-connected":
      showToast({
        title: "Track this in Resume Butler?",
        detail: "Connect the extension to add applications automatically.",
        warn: true,
        actions: [
          {
            label: "Connect",
            primary: true,
            onClick: async () => {
              await sendToBackground({ type: "open-connect" });
              return null;
            },
          },
        ],
      });
      break;
    case "duplicate":
      break;
    default:
      showToast({
        title: "Couldn't add to Resume Butler",
        detail: result?.error || "Try again from the extension.",
        warn: true,
      });
  }
};
