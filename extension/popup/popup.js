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

async function renderJob(connection) {
  const job = await currentTabJob();
  $("job").hidden = !job;
  $("no-job").hidden = Boolean(job);
  if (!job) return;
  const account = { userId: connection.userId, origin: connection.origin };
  $("job-role").textContent = job.role || "Untitled role";
  $("job-company").textContent = [job.company, job.location].filter(Boolean).join(", ");
  $("save-job").disabled = true;
  $("record").disabled = false;
  $("capture-result").textContent = "Loading your resume choices…";
  $("record").onclick = async () => {
    $("record").disabled = true;
    const result = await send({ type: "record", job, account });
    const messages = {
      added: "Added to your tracker.",
      updated: "Already in your tracker; updated with this posting.",
      queued: "Saved safely. Waiting to sync.",
      "needs-matching": "Saved for review. Choose the application in Resume Butler.",
      "not-connected": "Connect first.",
    };
    $("record-result").textContent = messages[result?.status] || result?.error || "Couldn't add it. Try again.";
    if (["added", "needs-matching", "queued"].includes(result?.status)) render();
    else $("record").disabled = false;
  };
  const context = await send({ type: "capture-context", job, account });
  const saved = context?.opportunity;
  const p = saved?.payload || {};
  $("capture-company").value = p.company ?? job.company ?? "";
  $("capture-role").value = p.role ?? job.role ?? "";
  $("capture-location").value = p.location ?? job.location ?? "";
  $("capture-description").value = p.job_description ?? job.description ?? "";
  const select = $("resume-choice");
  select.replaceChildren(new Option("Master CV / decide later", ""));
  for (const resume of context?.resumes || []) select.add(new Option(resume.title, resume.id));
  select.value = saved?.resume_id || "";
  globalThis.RB_autofillUi?.resumeChanged();
  $("capture-result").textContent = context?.error || (saved ? "✓ Saved · review or update below" : "Saving a job keeps it out of your applied count.");
  $("save-job").disabled = Boolean(!context || context.error);
  for (const id of ["capture-company", "capture-role", "capture-location", "capture-description", "resume-choice"]) {
    $(id).oninput = () => { $("capture-result").textContent = "Unsaved changes"; if (id === "resume-choice") globalThis.RB_autofillUi?.resumeChanged(); };
  }
  $("save-job").onclick = async () => {
    $("save-job").disabled = true;
    $("capture-result").textContent = "Saving…";
    const corrected = { ...job, company: $("capture-company").value, role: $("capture-role").value, location: $("capture-location").value, description: $("capture-description").value,
      ...(saved ? { salary: p.salary_min != null || p.salary_max != null ? { min: p.salary_min ?? null, max: p.salary_max ?? null, currency: p.salary_currency || "USD", period: p.salary_period || null } : null, employmentType: p.employment_type || "", workplaceType: p.workplace_type || "" } : {}),
    };
    const result = await send({ type: "save-job", job: corrected, resumeId: select.value || null, account });
    $("capture-result").textContent = result?.ok ? "✓ Saved · ready when you are" : result?.error || "Not saved. Keep this popup open and try again.";
    $("save-job").disabled = false;
  };

}

async function render() {
  const status = await send({ type: "status" });
  const connection = status?.connection;
  globalThis.RB_autofillUi?.init(connection);
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
  $("saved-jobs").href = connection.origin + "/saved-jobs";
  $("privacy").href = connection.origin + "/privacy";
  $("queue-review").hidden = !(status.queued || status.legacy);
  $("queued").textContent = status.needsMatching ? `${status.needsMatching} submission${status.needsMatching === 1 ? "" : "s"} need matching.`
    : status.blocked ? "A submission needs your attention before it can sync."
    : status.queued ? `${status.queued} saved safely, waiting to sync.` : "";
  $("review-matches").hidden = !(status.needsMatching || status.blocked);
  $("review-matches").href = connection.origin + "/applications#matching";
  $("legacy-note").hidden = !status.legacy;
  $("adopt-legacy").hidden = !status.legacy;
  $("adopt-legacy").textContent = `Assign ${status.legacy || ""} older queued item${status.legacy === 1 ? "" : "s"} to this account`;
  $("adopt-legacy").onclick = async () => {
    $("adopt-legacy").disabled = true;
    const result = await send({ type: "adopt-legacy", account: { userId: connection.userId, origin: connection.origin } });
    if (result?.ok) await render();
    else { $("queued").textContent = result?.error || "Couldn't assign the items. Try again."; $("adopt-legacy").disabled = false; }
  };
  renderRecent(status.recent || []);
  await renderJob(connection);
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
