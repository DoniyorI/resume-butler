// Top-frame Ashby adapter (jobs.ashbyhq.com). It knows field structure, never the
// user's profile, answer library or token. Only an explicit worker request supplies
// fill values. The inventory, caps and write procedure live in autofill-core.js.
// Ashby renders client-side and has no <form> element: the "form" here is the
// element that holds the application and survey containers. The adapter never
// clicks anything; Ashby's submit is a plain button and is left alone. Embedded
// Ashby boards inside an iframe on a company's own site are not supported.
(() => {
  if (window !== window.top || location.origin !== "https://jobs.ashbyhq.com") return;
  const { cleanLabel, manualQuestion, visible, register } = globalThis.RB_autofillCore;
  const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
  const APPLICATION_PATH = /^\/[A-Za-z0-9._-]{1,100}\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\/application\/?$/i;
  const ENTRY = ".ashby-application-form-field-entry";
  const TITLE = ".ashby-application-form-question-title";
  const contacts = {
    _systemfield_name: { sourceKey: "name", label: /^(?:full name|name)$/i, types: ["text"] },
    _systemfield_email: { sourceKey: "email", label: /^email(?: address)?$/i, types: ["text", "email"] },
    _systemfield_phone: { sourceKey: "phone", label: /^phone(?: number)?$/i, types: ["tel", "text"] },
  };
  const profileQuestions = [
    { sourceKey: "linkedin", label: /^linkedin(?: profile| url)?$/i },
    { sourceKey: "github", label: /^github(?: profile| url)?$/i },
    { sourceKey: "portfolio", label: /^(?:portfolio|website|personal website)(?: url)?$/i },
  ];
  const short = text => text.length > 300 ? `${text.slice(0, 299)}…` : text;

  const entryOf = element => element.closest("[data-field-path]");
  const pathOf = element => entryOf(element)?.getAttribute("data-field-path") || "";
  const titleOf = entry => {
    const title = entry?.querySelector(TITLE);
    return title ? cleanLabel(title.textContent) : "";
  };

  function labelFor(element) {
    const id = element.id, entry = entryOf(element);
    // A label[for] counts only inside the control's own field entry
    const label = id && entry ? [...entry.querySelectorAll("label[for]")].find(item => item.getAttribute("for") === id) : null;
    if (label) {
      const copy = label.cloneNode(true);
      copy.querySelectorAll("input,textarea,select").forEach(child => child.remove());
      const text = cleanLabel(copy.textContent);
      if (text) return text;
    }
    return titleOf(entry) || cleanLabel(element.getAttribute("aria-label"));
  }

  const signature = element => JSON.stringify([element.id, element.name, element.type, labelFor(element), element.maxLength,
    element.getAttribute("role"), element.getAttribute("autocomplete"), pathOf(element)]);

  function currentForm() {
    if (location.protocol !== "https:" || !APPLICATION_PATH.test(location.pathname)) throw new Error("Open the application form on Ashby, then review its fields.");
    const unsupported = () => new Error("This Ashby form is not ready or its layout is unsupported. Complete it manually.");
    const containers = [...document.querySelectorAll(".ashby-application-form-container")];
    const mains = containers.filter(item => !item.closest(".ashby-survey-form-container"));
    if (mains.length !== 1 || !visible(mains[0]) || !mains[0].querySelector(ENTRY)) throw unsupported();
    // The survey container is a sibling of the main one; their shared parent is the root.
    const root = mains[0].parentElement;
    const surveys = [...document.querySelectorAll(".ashby-survey-form-container")];
    if (!root || root === document.body || root === document.documentElement || !visible(root) ||
        !containers.every(item => root.contains(item)) || !surveys.every(item => root.contains(item))) throw unsupported();
    return root;
  }

  function classify(element, label) {
    const id = element.id, type = element.type, path = pathOf(element);
    const title = short(titleOf(entryOf(element)) || label);
    if (type === "file") return { manual: "Attach the intended file yourself.", label: label || title || "Resume" };
    if (path === "_systemfield_location") return { manual: "Choose a location from the site's suggestions.", label: label || "Current location" };
    if (element.closest(".ashby-survey-form-container") || manualQuestion.test(title) || manualQuestion.test(label)) {
      return { manual: "Complete this field yourself.", label: title || "Survey question" };
    }
    if (["radio", "checkbox"].includes(type) || element.tagName === "SELECT" || element.getAttribute("role") || element.getAttribute("aria-autocomplete") || element.getAttribute("list")) {
      return { manual: "Choose or enter this field manually.", label: title || label };
    }
    // Without its field entry the write-time re-check could not tell the control moved
    if (!label || label.length > 1000 || !element.closest(ENTRY)) return { manual: "Choose or enter this field manually.", label: title || label };
    if (id.startsWith("_systemfield_")) {
      const contact = Object.hasOwn(contacts, id) ? contacts[id] : null;
      return contact && path === id && element.name === id && contact.label.test(label) && contact.types.includes(type)
        ? { kind: "profile", sourceKey: contact.sourceKey } : { manual: "This field has no supported source." };
    }
    if (UUID.test(id) && element.name === id && path === id && ["text", "url", "textarea"].includes(type)) {
      const profile = profileQuestions.find(item => item.label.test(label));
      return profile ? { kind: "profile", sourceKey: profile.sourceKey } : { kind: "answer" };
    }
    return { manual: "This field has no supported source." };
  }

  register({
    currentForm, labelFor, signature, classify,
    // The yes/no checkbox mirrors its button pair, the reCAPTCHA response and the
    // resume-parsing uploader are never fields of the form.
    skip: (element, label) => Boolean(element.closest(".ashby-application-form-input-yesno")) || /^g-recaptcha-response/.test(element.id) ||
      element.classList.contains("g-recaptcha-response") || element.type === "file" && !label && !element.id && !entryOf(element),
    // A yes/no question is a pair of buttons: listed once, never clicked.
    extraManual: root => [...root.querySelectorAll(".ashby-application-form-input-yesno")].filter(visible).map(group => {
      const title = short(titleOf(entryOf(group)) || "Yes/No question");
      return { label: title, reason: group.closest(".ashby-survey-form-container") || manualQuestion.test(title) ? "Complete this field yourself." : "Choose or enter this field manually." };
    }),
    // A control moved into the survey container, or out of its field entry, is no longer the one reviewed
    owner: (element, root) => root.contains(element) && !element.closest(".ashby-survey-form-container") && element.closest(ENTRY) ? root : null,
    formSignature: root => JSON.stringify([root.id, root.getAttribute("role"), root.getAttribute("aria-labelledby"), location.pathname]),
    question: element => element.closest(ENTRY),
    identity: element => element.id || element.name,
    title: () => document.querySelector("h1")?.textContent || document.title,
  });
})();
