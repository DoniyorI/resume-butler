// A small notice in the top-right corner of the job site: "Tracking
// application" while an application is submitted, then what was added, with Undo. Rendered in a shadow root so the
// site's CSS can't restyle it, and built with textContent only.

const TOAST_STYLE = `
  :host { all: initial; }
  .toast {
    position: fixed; top: 12px; right: 12px; z-index: 2147483647;
    display: flex; align-items: center; gap: 8px;
    max-width: min(300px, calc(100vw - 24px)); box-sizing: border-box;
    padding: 7px 8px 7px 10px; border-radius: 10px; background: #fff; color: #0f172a;
    border: 1px solid #d7e9e2; box-shadow: 0 6px 20px -8px rgba(15, 23, 42, .3);
    font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    animation: enter .18s ease-out;
  }
  @keyframes enter { from { opacity: 0; transform: translateY(-6px); } }
  .dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: #559F87; }
  .dot.warn { background: #d97706; }
  .dot.pending { animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .35; } }
  @media (prefers-reduced-motion: reduce) { .toast, .dot.pending { animation: none; } }
  .body { flex: 1; min-width: 0; }
  .title { font-weight: 600; white-space: nowrap; }
  .detail { color: #64748b; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button {
    flex: none; font: inherit; font-weight: 600; cursor: pointer; border: 0; border-radius: 6px;
    padding: 3px 6px; background: none; color: #3f7f6a;
  }
  button:hover { background: #eef6f3; }
  button:focus-visible { outline: 2px solid #559F87; outline-offset: 1px; }
  .close { padding: 0 4px; color: #94a3b8; font-size: 15px; font-weight: 400; line-height: 1; }
`;

const TOAST_MS = 7_000;
let toastHost = null;

function removeToast() {
  toastHost?.remove();
  toastHost = null;
}

/**
 * Show a notice. `actions`: [{ label, onClick }]; an action's
 * onClick may return a message to show in place of the notice.
 */
function showToast({ title, detail, warn = false, pending = false, actions = [] }) {
  removeToast();
  toastHost = document.createElement("div");
  const root = toastHost.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = TOAST_STYLE;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  const dot = document.createElement("span");
  dot.className = warn ? "dot warn" : pending ? "dot pending" : "dot";
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
  toast.append(dot, body);
  for (const action of actions) {
    const button = document.createElement("button");
    button.textContent = action.label;
    button.addEventListener("click", async (event) => {
      button.disabled = true;
      const clicked = toastHost;
      const next = await action.onClick(event);
      if (next) showToast(next);
      // Close this notice, unless the action already replaced it with another
      else if (toastHost === clicked) removeToast();
    });
    toast.append(button);
  }
  const close = document.createElement("button");
  close.className = "close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";
  close.addEventListener("click", removeToast);

  toast.append(close);
  root.append(style, toast);
  document.documentElement.append(toastHost);
  const host = toastHost;
  setTimeout(() => host === toastHost && removeToast(), TOAST_MS);
}

const sendToBackground = (message) =>
  new Promise((resolve) =>
    chrome.runtime.sendMessage(message, (reply) => resolve(chrome.runtime.lastError ? null : reply))
  );

// Shown as soon as the submit button is clicked, until the result replaces it
globalThis.RB_showTracking = function showTracking(job) {
  showToast({
    title: "Tracking application",
    detail: [job.role, job.company].filter(Boolean).join(" at "),
    pending: true,
  });
};

// The notice for what the background worker did with a submitted application
globalThis.RB_showResult = function showResult(result, job, key) {
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
        detail: what,
      });
      break;
    case "queued":
      showToast({ title: "Saved for Resume Butler", detail: "Adding it when you're back online" });
      break;
    case "not-connected":
      showToast({
        title: "Not tracked yet",
        detail: "Connect Resume Butler to track this",
        warn: true,
        actions: [
          {
            label: "Connect",
            onClick: async () => {
              await sendToBackground({ type: "open-connect" });
              return null;
            },
          },
        ],
      });
      break;
    case "unconfirmed":
      showToast({
        title: "Did you apply?",
        detail: what,
        actions: [
          {
            label: "Add",
            onClick: async (event) => {
              if (!event.isTrusted) return null;
              const reply = await sendToBackground({ type: "confirm-submitted", key, job });
              globalThis.RB_showResult(reply, job, key);
              return null;
            },
          },
        ],
      });
      break;
    case "duplicate":
    case "ignored":
      removeToast();
      break;
    default:
      showToast({
        title: "Couldn't add to Resume Butler",
        detail: result?.error || "Try again from the extension.",
        warn: true,
      });
  }
};
