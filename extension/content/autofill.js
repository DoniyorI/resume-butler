// Top-frame Lever adapter. It knows field structure, never the user's profile,
// answer library or token. Only an explicit worker request supplies fill values.
(() => {
  if (window !== window.top || location.hostname !== "jobs.lever.co") return;
  try { globalThis.RB_autofill?.stop(); } catch { /* Old extension context. */ }
  let inventory = null;
  const contacts = {
    name: { sourceKey: "name", label: /^(?:full name|name)$/i, types: ["text"] },
    email: { sourceKey: "email", label: /^email(?: address)?$/i, types: ["text", "email"] },
    phone: { sourceKey: "phone", label: /^phone(?: number)?$/i, types: ["text", "tel"] },
    "urls[LinkedIn]": { sourceKey: "linkedin", label: /^linkedin(?: url)?$/i, types: ["text", "url"] },
    "urls[GitHub]": { sourceKey: "github", label: /^github(?: url)?$/i, types: ["text", "url"] },
    "urls[Portfolio]": { sourceKey: "portfolio", label: /^portfolio(?: url)?$/i, types: ["text", "url"] },
  };
  const manualQuestion = /\b(referr(?:al|ed|er|ing)?|signature|sign here|consent|terms|privacy policy|attest|gender|race|ethnicity|disabilit\w*|veteran\w*|religion|date of birth|social security|ssn)\b|\bi (?:hereby )?(?:agree|certify)\b|\bhow did you (?:hear|learn|find)\b/i;
  const cleanLabel = text => String(text || "").replace(/\s+/g, " ").trim().replace(/\s*[✱*]$/u, "").trim();

  function labelFor(element) {
    const label = element.closest(".application-question")?.querySelector(".application-label") || element.labels?.[0];
    if (!label) return "";
    const copy = label.cloneNode(true);
    copy.querySelectorAll("input,textarea,select").forEach(child => child.remove());
    return cleanLabel(copy.textContent);
  }

  function visible(element) {
    if (!element.isConnected || !element.getClientRects().length) return false;
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (parent.hidden || parent.inert || parent.getAttribute("aria-hidden") === "true" ||
          style.display === "none" || ["hidden", "collapse"].includes(style.visibility) || Number(style.opacity) === 0) return false;
    }
    return true;
  }

  const editable = element => !element.matches(":disabled") && !element.readOnly && element.getAttribute("aria-disabled") !== "true";
  const signature = element => JSON.stringify([element.name, element.type, labelFor(element), element.maxLength, element.getAttribute("role"), element.getAttribute("autocomplete")]);
  const formSignature = form => JSON.stringify([form.action, form.method, form.getAttribute("target") || ""]);

  function currentForm() {
    if (location.protocol !== "https:" || !/^\/[^/]+\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\/apply\/?$/i.test(location.pathname)) {
      throw new Error("Open the application form on Lever, then review its fields.");
    }
    const forms = document.querySelectorAll("form#application-form");
    if (forms.length !== 1 || forms[0].method !== "post" || !visible(forms[0])) throw new Error("This Lever form is not ready or its layout is unsupported. Complete it manually.");
    return forms[0];
  }

  function scan() {
    const form = currentForm(), candidates = [], manual = [];
    const addManual = (label, reason) => {
      if (!manual.some(item => item.label === label && item.reason === reason)) manual.push({ label: label || "Unlabeled field", reason });
    };
    for (const element of form.querySelectorAll("input,textarea,select")) {
      if (["hidden", "submit", "button", "reset"].includes(element.type) || !visible(element)) continue;
      const label = labelFor(element);
      if (!editable(element)) { addManual(label, "This field is not editable."); continue; }
      if (element.type === "file") { addManual(label || "Resume/CV", "Attach the intended file yourself."); continue; }
      if (/^eeo\[/i.test(element.name) || manualQuestion.test(label) || /referr/i.test(element.name)) {
        addManual(label, "Complete this field yourself."); continue;
      }
      if (element.id === "location-input" || element.name === "location") {
        addManual(label || "Current location", "Choose a location from the site's suggestions."); continue;
      }
      if (element.name === "org") { addManual(label || "Current company", "Enter your current employer yourself."); continue; }
      if (!label || label.length > 1000 || !["text", "email", "tel", "url", "textarea"].includes(element.type) ||
          element.getAttribute("role") || element.getAttribute("aria-autocomplete") || element.getAttribute("list")) {
        addManual(label, "Choose or enter this field manually."); continue;
      }
      const contact = Object.hasOwn(contacts, element.name) ? contacts[element.name] : null;
      let kind, sourceKey;
      if (contact && contact.label.test(label) && contact.types.includes(element.type)) {
        kind = "profile"; sourceKey = contact.sourceKey;
      } else if ((/^cards\[[a-f0-9-]{36}\]\[field\d+\]$/i.test(element.name) || element.name === "comments") && ["text", "textarea"].includes(element.type)) {
        kind = "answer";
      } else { addManual(label, "This field has no supported source."); continue; }
      candidates.push({ id: crypto.randomUUID(), label, kind, ...(sourceKey && { sourceKey }), empty: element.value === "", maxLength: element.maxLength, multiline: element.tagName === "TEXTAREA",
        element, question: element.closest(".application-question"), signature: signature(element) });
    }
    const fields = new Map();
    for (const field of candidates) {
      if (candidates.some(other => other !== field && (other.element.name === field.element.name || other.label.toLowerCase() === field.label.toLowerCase()))) {
        addManual(field.label, "Repeated fields are ambiguous. Complete them manually."); continue;
      }
      fields.set(field.id, field);
    }
    if (fields.size > 100 || manual.length > 100) throw new Error("This form has too many fields for reviewed autofill. Complete it manually.");
    inventory = { id: crypto.randomUUID(), url: location.href, form, signature: formSignature(form), fields };
    return { ok: true, inventoryId: inventory.id, url: inventory.url, title: (document.querySelector(".posting-headline h2")?.textContent || document.title).trim().slice(0, 250),
      fields: [...fields.values()].map(({ id, label, kind, sourceKey, empty, maxLength, multiline }) => ({ id, label, kind, ...(sourceKey && { sourceKey }), empty, maxLength, multiline })), manual };
  }

  function inventoryCurrent() {
    try { return inventory && inventory.url === location.href && currentForm() === inventory.form && inventory.signature === formSignature(inventory.form); }
    catch { return false; }
  }

  function apply(message) {
    const timely = () => Number.isFinite(message.expiresAt) && Date.now() < message.expiresAt && document.visibilityState === "visible";
    if (!timely()) throw new Error("Return to this form and review its fields again before filling.");
    if (!inventory || inventory.id !== message.inventoryId || !inventoryCurrent()) throw new Error("The form changed. Review its fields again before filling.");
    if (!Array.isArray(message.values) || !message.values.length || message.values.length > 50 || new Set(message.values.map(item => item?.fieldId)).size !== message.values.length ||
        message.values.some(item => !inventory.fields.has(item?.fieldId) || typeof item.value !== "string" || !item.value.length || item.value.length > 10000)) throw new Error("Review the selected fields again.");
    const outcomes = [];
    for (const { fieldId, value } of message.values) {
      const field = inventory.fields.get(fieldId), element = field.element;
      let status;
      if (!timely() || !inventoryCurrent()) status = "changed";
      else if (!element.isConnected || element.form !== inventory.form || element.closest(".application-question") !== field.question || signature(element) !== field.signature) status = "changed";
      else if (!visible(element) || !editable(element)) status = "unavailable";
      else if (element.value !== "") status = "preserved";
      else if (element.maxLength >= 0 && value.length > element.maxLength || element.tagName === "INPUT" && /[\r\n]/.test(value)) status = "too-long";
      else {
        const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        status = element.isConnected && element.value === value ? "filled" : "rejected";
      }
      outcomes.push({ fieldId, status });
    }
    return { ok: true, outcomes };
  }

  const listener = (message, sender, respond) => {
    if (!["autofill:scan", "autofill:apply"].includes(message?.type) || sender.id !== chrome.runtime.id || sender.tab) return false;
    try { respond(message.type === "autofill:scan" ? scan() : apply(message)); }
    catch (error) { respond({ ok: false, error: error.message }); }
    return false;
  };
  chrome.runtime.onMessage.addListener(listener);
  globalThis.RB_autofill = { stop: () => { inventory = null; chrome.runtime.onMessage.removeListener(listener); } };
})();
