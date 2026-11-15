// Top-frame Greenhouse adapter (job-boards.greenhouse.io). It knows field
// structure, never the user's profile, answer library or token. Only an explicit
// worker request supplies fill values. The inventory, caps and write procedure
// live in autofill-core.js. Embedded iframes on company sites are not supported.
(() => {
  if (window !== window.top || location.hostname !== "job-boards.greenhouse.io") return;
  const { cleanLabel, manualQuestion, visible, register } = globalThis.RB_autofillCore;
  const contacts = {
    first_name: { sourceKey: "firstName", label: /^first name$/i, types: ["text"] },
    last_name: { sourceKey: "lastName", label: /^last name$/i, types: ["text"] },
    email: { sourceKey: "email", label: /^email(?: address)?$/i, types: ["text", "email"] },
    phone: { sourceKey: "phone", label: /^phone(?: number)?$/i, types: ["tel", "text"] },
  };
  const profileQuestions = [
    { sourceKey: "linkedin", label: /^linkedin(?: profile| url)?$/i },
    { sourceKey: "github", label: /^github(?: profile| url)?$/i },
    { sourceKey: "portfolio", label: /^(?:portfolio|website|personal website)(?: url)?$/i },
  ];
  const manualIds = ["gender", "hispanic_ethnicity", "veteran_status", "race", "disability_status"];

  function labelFor(element) {
    const id = element.id;
    const label = id ? [...document.querySelectorAll("label[for]")].find(item => item.getAttribute("for") === id) : null;
    if (label) {
      const copy = label.cloneNode(true);
      copy.querySelectorAll("input,textarea,select").forEach(child => child.remove());
      const text = cleanLabel(copy.textContent);
      if (text) return text;
    }
    const aria = cleanLabel(element.getAttribute("aria-label"));
    if (aria) return aria;
    const named = (element.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean)
      .map(name => document.getElementById(name)?.textContent || "").join(" ");
    return cleanLabel(named);
  }

  const signature = element => JSON.stringify([element.id, element.type, labelFor(element), element.maxLength, element.getAttribute("role"), element.getAttribute("autocomplete")]);

  function formUrlSupported() {
    if (location.protocol !== "https:") return false;
    if (/^\/[A-Za-z0-9_-]{1,100}\/jobs\/\d{1,20}\/?$/.test(location.pathname)) return true;
    if (location.pathname !== "/embed/job_app") return false;
    const boards = new URLSearchParams(location.search).getAll("for"), tokens = new URLSearchParams(location.search).getAll("token");
    return boards.length === 1 && /^[A-Za-z0-9_-]{1,100}$/.test(boards[0]) && tokens.length === 1 && /^\d{1,20}$/.test(tokens[0]);
  }

  function currentForm() {
    if (!formUrlSupported()) throw new Error("Open the application form on Greenhouse, then review its fields.");
    const forms = document.querySelectorAll("form#application-form");
    if (forms.length !== 1 || !visible(forms[0])) throw new Error("This Greenhouse form is not ready or its layout is unsupported. Complete it manually.");
    return forms[0];
  }

  function classify(element, label) {
    const id = element.id, type = element.type;
    if (type === "file") return { manual: "Attach the intended file yourself.", label: label || "Resume/CV" };
    if (element.tagName === "TEXTAREA" && (id === "resume_text" || id === "cover_letter_text")) return { manual: "Paste or attach this yourself." };
    if (manualIds.includes(id) || manualQuestion.test(label)) return { manual: "Complete this field yourself." };
    if (element.getAttribute("role") || element.getAttribute("aria-autocomplete") || element.getAttribute("list") || element.tagName === "SELECT" || ["checkbox", "radio"].includes(type)) {
      return { manual: "Choose or enter this field manually." };
    }
    if (!label || label.length > 1000) return { manual: "Choose or enter this field manually." };
    const contact = Object.hasOwn(contacts, id) ? contacts[id] : null;
    if (contact && contact.label.test(label) && contact.types.includes(type)) return { kind: "profile", sourceKey: contact.sourceKey };
    if (/^question_\d+$/.test(id) && ["text", "url", "textarea"].includes(type)) {
      const profile = profileQuestions.find(item => item.label.test(label));
      return profile ? { kind: "profile", sourceKey: profile.sourceKey } : { kind: "answer" };
    }
    return { manual: "This field has no supported source." };
  }

  register({
    currentForm, labelFor, signature, classify,
    // Required-field shims have no id and no label; they are never listed.
    skip: (element, label) => !element.id && !label,
    formSignature: form => JSON.stringify([form.id, form.action, form.method]),
    question: element => element.closest(".field-wrapper"),
    identity: element => element.id,
    title: () => document.querySelector("h1.section-header")?.textContent || document.title,
  });
})();
