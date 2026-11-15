// Top-frame Lever adapter. It knows field structure, never the user's profile,
// answer library or token. Only an explicit worker request supplies fill values.
// The inventory, caps and write procedure live in autofill-core.js.
(() => {
  if (window !== window.top || location.hostname !== "jobs.lever.co") return;
  const { cleanLabel, manualQuestion, visible, register } = globalThis.RB_autofillCore;
  const contacts = {
    name: { sourceKey: "name", label: /^(?:full name|name)$/i, types: ["text"] },
    email: { sourceKey: "email", label: /^email(?: address)?$/i, types: ["text", "email"] },
    phone: { sourceKey: "phone", label: /^phone(?: number)?$/i, types: ["text", "tel"] },
    "urls[LinkedIn]": { sourceKey: "linkedin", label: /^linkedin(?: url)?$/i, types: ["text", "url"] },
    "urls[GitHub]": { sourceKey: "github", label: /^github(?: url)?$/i, types: ["text", "url"] },
    "urls[Portfolio]": { sourceKey: "portfolio", label: /^portfolio(?: url)?$/i, types: ["text", "url"] },
  };

  function labelFor(element) {
    const label = element.closest(".application-question")?.querySelector(".application-label") || element.labels?.[0];
    if (!label) return "";
    const copy = label.cloneNode(true);
    copy.querySelectorAll("input,textarea,select").forEach(child => child.remove());
    return cleanLabel(copy.textContent);
  }

  const signature = element => JSON.stringify([element.name, element.type, labelFor(element), element.maxLength, element.getAttribute("role"), element.getAttribute("autocomplete")]);

  function currentForm() {
    if (location.protocol !== "https:" || !/^\/[^/]+\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\/apply\/?$/i.test(location.pathname)) {
      throw new Error("Open the application form on Lever, then review its fields.");
    }
    const forms = document.querySelectorAll("form#application-form");
    if (forms.length !== 1 || forms[0].method !== "post" || !visible(forms[0])) throw new Error("This Lever form is not ready or its layout is unsupported. Complete it manually.");
    return forms[0];
  }

  function classify(element, label) {
    if (element.type === "file") return { manual: "Attach the intended file yourself.", label: label || "Resume/CV" };
    if (/^eeo\[/i.test(element.name) || manualQuestion.test(label) || /referr/i.test(element.name)) return { manual: "Complete this field yourself." };
    if (element.id === "location-input" || element.name === "location") return { manual: "Choose a location from the site's suggestions.", label: label || "Current location" };
    if (element.name === "org") return { manual: "Enter your current employer yourself.", label: label || "Current company" };
    if (!label || label.length > 1000 || !["text", "email", "tel", "url", "textarea"].includes(element.type) ||
        element.getAttribute("role") || element.getAttribute("aria-autocomplete") || element.getAttribute("list")) {
      return { manual: "Choose or enter this field manually." };
    }
    const contact = Object.hasOwn(contacts, element.name) ? contacts[element.name] : null;
    if (contact && contact.label.test(label) && contact.types.includes(element.type)) return { kind: "profile", sourceKey: contact.sourceKey };
    if ((/^cards\[[a-f0-9-]{36}\]\[field\d+\]$/i.test(element.name) || element.name === "comments") && ["text", "textarea"].includes(element.type)) return { kind: "answer" };
    return { manual: "This field has no supported source." };
  }

  register({
    currentForm, labelFor, signature, classify,
    formSignature: form => JSON.stringify([form.action, form.method, form.getAttribute("target") || ""]),
    question: element => element.closest(".application-question"),
    identity: element => element.name,
    title: () => document.querySelector(".posting-headline h2")?.textContent || document.title,
  });
})();
