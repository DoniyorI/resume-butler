// Shared, platform-neutral part of reviewed autofill. A site adapter (Lever,
// Greenhouse) supplies how to find and describe its form; this file owns the
// inventory, the caps and the whole write procedure, so every platform keeps the
// same rules: never submit, never attach a file, never overwrite typed input.
(() => {
  const cleanLabel = text => String(text || "").replace(/\s+/g, " ").trim().replace(/\s*[✱*]$/u, "").trim();
  const manualQuestion = /\b(referr(?:al|ed|er|ing)?|signature|sign here|consent|terms|privacy policy|attest|gender|race|ethnicity|disabilit\w*|veteran\w*|religion|date of birth|social security|ssn)\b|\bi (?:hereby )?(?:agree|certify)\b|\bhow did you (?:hear|learn|find)\b/i;

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

  // adapter: {
  //   currentForm()        the one supported form, or throws a user-safe Error
  //   formSignature(form)  JSON string identifying the form
  //   labelFor(element)    cleaned label text
  //   signature(element)   JSON string identifying one control
  //   question(element)    the wrapper that must stay the same between scan and write
  //   identity(element)    the control's name or id, for duplicate detection
  //   skip?(element, label)  true to ignore a control silently (checked before editability)
  //   classify(element, label)  { manual: reason, label? } | { kind, sourceKey? }
  //   title()              the posting's title
  // }
  function register(adapter) {
    try { globalThis.RB_autofill?.stop(); } catch { /* Old extension context. */ }
    let inventory = null;

    function scan() {
      const form = adapter.currentForm(), candidates = [], manual = [];
      const addManual = (label, reason) => {
        if (!manual.some(item => item.label === label && item.reason === reason)) manual.push({ label: label || "Unlabeled field", reason });
      };
      for (const element of form.querySelectorAll("input,textarea,select")) {
        if (["hidden", "submit", "button", "reset"].includes(element.type) || !visible(element)) continue;
        const label = adapter.labelFor(element);
        if (adapter.skip?.(element, label)) continue;
        if (!editable(element)) { addManual(label, "This field is not editable."); continue; }
        const outcome = adapter.classify(element, label);
        if (outcome.manual) { addManual(outcome.label ?? label, outcome.manual); continue; }
        candidates.push({ id: crypto.randomUUID(), label, kind: outcome.kind, ...(outcome.sourceKey && { sourceKey: outcome.sourceKey }),
          empty: element.value === "", maxLength: element.maxLength, multiline: element.tagName === "TEXTAREA",
          element, question: adapter.question(element), signature: adapter.signature(element) });
      }
      const fields = new Map();
      for (const field of candidates) {
        if (candidates.some(other => other !== field && (adapter.identity(other.element) === adapter.identity(field.element) || other.label.toLowerCase() === field.label.toLowerCase()))) {
          addManual(field.label, "Repeated fields are ambiguous. Complete them manually."); continue;
        }
        fields.set(field.id, field);
      }
      if (fields.size > 100 || manual.length > 100) throw new Error("This form has too many fields for reviewed autofill. Complete it manually.");
      inventory = { id: crypto.randomUUID(), url: location.href, form, signature: adapter.formSignature(form), fields };
      return { ok: true, inventoryId: inventory.id, url: inventory.url, title: String(adapter.title() || document.title).trim().slice(0, 250),
        fields: [...fields.values()].map(({ id, label, kind, sourceKey, empty, maxLength, multiline }) => ({ id, label, kind, ...(sourceKey && { sourceKey }), empty, maxLength, multiline })), manual };
    }

    function inventoryCurrent() {
      try { return inventory && inventory.url === location.href && adapter.currentForm() === inventory.form && inventory.signature === adapter.formSignature(inventory.form); }
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
        else if (!element.isConnected || element.form !== inventory.form || adapter.question(element) !== field.question || adapter.signature(element) !== field.signature) status = "changed";
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
  }

  globalThis.RB_autofillCore = { cleanLabel, manualQuestion, visible, editable, register };
})();
