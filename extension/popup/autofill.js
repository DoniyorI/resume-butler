// Trusted popup review. Source reads and form writes go through the worker;
// job-page text is always rendered as text, never as HTML.
(() => {
  const $ = id => document.getElementById(id);
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const send = message => new Promise(resolve => chrome.runtime.sendMessage(message, reply => resolve(chrome.runtime.lastError ? null : reply)));
  let current = null;

  function status(text, error = false) {
    $("autofill-status").textContent = text;
    $("autofill-status").classList.toggle("fill-error", error);
  }

  function resumeChanged() {
    if (!current) return;
    const select = $("resume-choice"), id = select?.value;
    const option = select?.selectedOptions?.[0];
    const valid = /^[a-f0-9-]{36}$/i.test(id || "") && option;
    $("autofill-resume").hidden = !valid;
    if (valid) {
      $("autofill-resume").href = `${current.account.origin}/resumes/${encodeURIComponent(id)}`;
      $("autofill-resume").textContent = `Open ${option.textContent}`;
    }
    $("autofill-resume-note").textContent = valid ? "Download the intended version, then attach it yourself. Save your resume choice with this job."
      : "Select a working resume in this popup, or attach a file you have already prepared.";
  }

  function manualFields(state) {
    return [...state.review.manual, ...state.review.fields.filter(field => field.empty && (!state.selected.has(field.id) || ["changed", "unavailable", "too-long", "rejected"].includes(state.outcomes.get(field.id))))
      .map(field => ({ label: field.label, reason: field.reason || "Not selected. Complete it yourself if needed." }))];
  }

  function updateControls(state) {
    if (current !== state) return;
    $("autofill-review").disabled = state.busy;
    if (!state.review) return;
    for (const element of $("autofill-fields").querySelectorAll("input,select,button")) {
      const field = state.review.fields.find(item => item.id === element.dataset.fieldId);
      const role = element.dataset.fillRole;
      element.disabled = state.busy || state.stale || (role !== "copy" && state.consumed) ||
        (role === "select" ? !field.empty : role === "copy" ? !field.value : !field.selected);
    }
    const count = state.selected.size, kept = state.review.fields.filter(field => !field.empty).length;
    const manual = manualFields(state);
    $("autofill-summary").hidden = state.consumed;
    $("autofill-summary").textContent = `${count} selected, ${kept} existing value${kept === 1 ? "" : "s"} kept, ${manual.length} left for your review.`;
    $("autofill-apply").textContent = state.busy ? "Checking fields…" : state.consumed ? "Selected fields checked" : `Fill ${count} selected field${count === 1 ? "" : "s"}`;
    $("autofill-apply").disabled = state.busy || state.stale || state.consumed || !count;
    $("autofill-manual-summary").textContent = `${manual.length} fields to review manually`;
    $("autofill-manual").hidden = !manual.length;
    const list = $("autofill-manual-list"); list.replaceChildren();
    for (const field of manual) {
      const item = node("div", "fill-manual-item");
      item.append(node("strong", "", field.label), node("p", "muted", field.reason)); list.append(item);
    }
  }

  function failed(state, reply) {
    state.stale = true;
    status(reply?.error || "The review is unavailable. Review the fields again; existing input is kept.", true);
  }

  function manualCopy(value, trigger) {
    const dialog = node("dialog", "fill-copy-dialog");
    dialog.setAttribute("aria-labelledby", "fill-copy-title");
    const heading = node("h2", "", "Copy manually"); heading.id = "fill-copy-title";
    const text = node("p", "muted", "Clipboard access is unavailable. Select the text and copy it yourself.");
    const area = node("textarea"); area.value = value; area.readOnly = true; area.rows = 8; area.setAttribute("aria-label", "Reviewed text to copy");
    const select = node("button", "secondary", "Select text"); select.type = "button"; select.onclick = () => { area.focus(); area.select(); };
    const close = node("button", "link", "Close"); close.type = "button"; close.onclick = () => dialog.close();
    dialog.append(heading, text, area, select, close); document.body.append(dialog);
    dialog.addEventListener("close", () => { dialog.remove(); if (trigger.isConnected) trigger.focus(); });
    dialog.showModal(); area.focus(); area.select();
  }

  async function copy(state, field, button) {
    state.busy = true; updateControls(state);
    try {
      const reply = await send({ type: "autofill-copy", ...state.base, reviewId: state.review.id, fieldId: field.id });
      if (current !== state) return;
      if (!reply?.ok) { failed(state, reply); return; }
      try { await navigator.clipboard.writeText(reply.value); button.textContent = "Copied"; }
      catch { manualCopy(reply.value, button); }
    } finally { state.busy = false; updateControls(state); }
  }

  async function selectAnswer(state, field, select) {
    state.busy = true; updateControls(state);
    try {
      const reply = await send({ type: "autofill-select", ...state.base, reviewId: state.review.id, fieldId: field.id, answerId: select.value });
      if (current !== state) return;
      if (!reply?.ok) { failed(state, reply); return; }
      state.review.fields = state.review.fields.map(item => item.id === field.id ? reply.field : item);
      if (reply.field.selected) state.selected.add(field.id); else state.selected.delete(field.id);
      renderFields(state);
      document.getElementById(`fill-answer-${field.id}`)?.focus();
    } finally { state.busy = false; updateControls(state); }
  }

  function renderFields(state) {
    const list = $("autofill-fields"); list.replaceChildren();
    for (const field of state.review.fields) {
      const row = node("div", "fill-field"); row.setAttribute("role", "group"); row.setAttribute("aria-labelledby", `fill-label-${field.id}`);
      const label = node("label", "fill-field-label");
      const checkbox = node("input"); checkbox.type = "checkbox"; checkbox.checked = state.selected.has(field.id);
      checkbox.dataset.fieldId = field.id; checkbox.dataset.fillRole = "check";
      checkbox.onchange = () => { if (checkbox.checked) state.selected.add(field.id); else state.selected.delete(field.id); updateControls(state); };
      const title = node("span", "", field.label); title.id = `fill-label-${field.id}`;
      label.append(checkbox, title); row.append(label);
      if (field.sourceLabel && field.empty) row.append(node("p", "fill-source", field.kind === "profile" ? "Master CV" : `${field.sourceLabel} (approved v${field.answerRevision})`));
      if (field.kind === "answer" && field.empty) {
        const select = node("select", "fill-answer-choice"); select.id = `fill-answer-${field.id}`;
        select.setAttribute("aria-label", `Approved answer for ${field.label}`); select.dataset.fieldId = field.id; select.dataset.fillRole = "select";
        select.add(new Option("Choose an approved answer", ""));
        for (const choice of state.review.choices) select.add(new Option(choice.label, choice.id));
        select.value = field.answerId || ""; select.onchange = () => selectAnswer(state, field, select); row.append(select);
      }
      if (field.value && field.empty) {
        const preview = node("p", "fill-value", field.value.length > 320 ? `${field.value.slice(0, 320)}…` : field.value); row.append(preview);
        if (field.value.length > 320) {
          const details = node("details", "fill-full-answer");
          details.append(node("summary", "", "Read full answer"), node("p", "fill-value", field.value)); row.append(details);
        }
        const button = node("button", "fill-copy", "Copy"); button.type = "button";
        button.setAttribute("aria-label", `Copy ${field.label}`); button.dataset.fieldId = field.id; button.dataset.fillRole = "copy";
        button.onclick = () => copy(state, field, button); row.append(button);
      }
      const outcome = state.outcomes.get(field.id);
      const messages = { filled: "Filled", preserved: "Existing value kept", changed: "Field changed; review it manually", unavailable: "Field unavailable; review it manually", "too-long": "Too long; copy and edit manually", rejected: "The site changed this value; check the form" };
      if (outcome || field.reason) row.append(node("p", outcome === "filled" ? "fill-outcome" : "fill-reason", messages[outcome] || field.reason));
      list.append(row);
    }
    updateControls(state);
  }

  async function prepare(state) {
    state.busy = true; state.stale = true; state.review = null; state.consumed = false;
    $("autofill-body").hidden = true; $("autofill-fields").replaceChildren();
    status("Reading this form and checking your saved details…"); updateControls(state);
    try {
      const reply = await send({ type: "autofill-prepare", ...state.base });
      if (current !== state) return;
      if (!reply?.ok) { failed(state, reply); return; }
      state.review = reply.review; state.stale = false; state.outcomes = new Map();
      state.selected = new Set(state.review.fields.filter(field => field.selected).map(field => field.id));
      $("autofill-job").textContent = state.review.title;
      $("autofill-body").hidden = false; $("autofill-review").textContent = "Review again";
      status("Check each value, then fill the fields you selected."); renderFields(state); resumeChanged();
      $("autofill-body").scrollIntoView({ block: "start" });
    } finally { state.busy = false; updateControls(state); }
  }

  async function fill(state) {
    state.busy = true; updateControls(state); status("Checking the latest approved versions before filling…");
    try {
      const reply = await send({ type: "autofill-fill", ...state.base, reviewId: state.review.id, fieldIds: [...state.selected] });
      if (current !== state) return;
      if (!reply?.ok) { failed(state, reply); return; }
      state.consumed = true; state.outcomes = new Map(reply.outcomes.map(item => [item.fieldId, item.status]));
      const filled = reply.outcomes.filter(item => item.status === "filled").length;
      const kept = reply.outcomes.filter(item => item.status === "preserved").length;
      const skipped = reply.outcomes.length - filled - kept;
      status(`${filled} filled, ${kept} existing value${kept === 1 ? "" : "s"} kept${skipped ? `, ${skipped} need manual review` : ""}. Review the form and attach your resume yourself.`);
      renderFields(state);
    } finally { state.busy = false; updateControls(state); }
  }

  async function init(connection) {
    const state = { account: connection, busy: false, stale: false, consumed: false, review: null, selected: new Set(), outcomes: new Map() };
    current = state;
    $("autofill").hidden = true; $("autofill-body").hidden = true; $("autofill-fields").replaceChildren();
    if (!connection) return;
    let tab;
    try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch { return; }
    if (current !== state) return;
    try { if (new URL(tab?.url).origin !== "https://jobs.lever.co" || !/\/apply\/?$/.test(new URL(tab.url).pathname)) return; } catch { return; }
    state.base = { account: { userId: connection.userId, origin: connection.origin }, tab: { id: tab.id, url: tab.url } };
    $("job").before($("autofill"));
    $("autofill").hidden = false;
    $("autofill-review").textContent = "Review fields"; $("autofill-review").disabled = false;
    $("autofill-review").onclick = () => prepare(state); $("autofill-apply").onclick = () => fill(state);
    $("autofill-profile").href = `${connection.origin}/profile`; $("autofill-answers").href = `${connection.origin}/answers`;
    status("Contact details come from your Master CV. Existing input stays as you entered it."); resumeChanged();
  }

  globalThis.RB_autofillUi = { init, resumeChanged };
})();
