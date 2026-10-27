// The toolbar popup: connection status, the job on the current tab with a
// manual "I applied to this", and recent additions with Undo. All data comes
// from the background worker; nothing here talks to the app directly.

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;
const $ = (id) => document.getElementById(id);

const send = (message) =>
  new Promise((resolve) =>
    chrome.runtime.sendMessage(message, (reply) => resolve(chrome.runtime.lastError ? null : reply))
  );

async function currentTabJob() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  return new Promise((resolve) =>
    chrome.tabs.sendMessage(tab.id, { type: "read-job" }, (job) =>
      resolve(chrome.runtime.lastError ? null : job)
    )
  );
}

function renderRecent(recent) {
  const list = $("recent");
  list.replaceChildren();
  const now = Date.now();
  for (const item of recent) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = [item.role, item.company].filter(Boolean).join(" at ");
    label.title = label.textContent;
    li.append(label);
    if (now - item.addedAt < UNDO_WINDOW_MS) {
      const undo = document.createElement("button");
      undo.type = "button";
      undo.textContent = "Undo";
      undo.addEventListener("click", async () => {
        undo.disabled = true;
        const reply = await send({ type: "undo", id: item.id });
        if (reply?.ok) li.remove();
        else {
          undo.textContent = "Can't undo";
          undo.title = reply?.error || "";
        }
      });
      li.append(undo);
    }
    list.append(li);
  }
  $("recent-wrap").hidden = recent.length === 0;
}

async function renderJob() {
  const job = await currentTabJob();
  $("job").hidden = !job;
  $("no-job").hidden = Boolean(job);
  if (!job) return;
  $("job-role").textContent = job.role || "Untitled role";
  $("job-company").textContent = [job.company, job.location].filter(Boolean).join(", ");
  $("record").onclick = async () => {
    $("record").disabled = true;
    const result = await send({ type: "record", job });
    const messages = {
      added: "Added to your tracker.",
      updated: "Already in your tracker; updated with this posting.",
      queued: "Saved. It will be added when you're back online.",
      "not-connected": "Connect first.",
    };
    $("record-result").textContent =
      messages[result?.status] || result?.error || "Couldn't add it. Try again.";
    if (result?.status === "added") render();
    else $("record").disabled = false;
  };
}

async function render() {
  const status = await send({ type: "status" });
  const connection = status?.connection;
  $("connected").hidden = !connection;
  $("disconnected").hidden = Boolean(connection);

  if (!connection) {
    // Unpacked (development) installs can also connect to the local app
    chrome.management.getSelf((self) => {
      $("connect-local").hidden = self?.installType !== "development";
    });
    return;
  }

  $("account").textContent = connection.name || connection.email || "your account";
  $("account").title = connection.email || "";
  $("open-app").href = connection.origin + "/";
  $("queued").hidden = !status.queued;
  $("queued").textContent = `${status.queued} waiting to sync. They'll be added when you're back online.`;
  renderRecent(status.recent || []);
  await renderJob();
}

$("connect").addEventListener("click", () => send({ type: "open-connect" }).then(() => window.close()));
$("connect-local").addEventListener("click", () =>
  send({ type: "open-connect", origin: "http://localhost:3000" }).then(() => window.close())
);
$("disconnect").addEventListener("click", async () => {
  await send({ type: "disconnect" });
  render();
});

render();
