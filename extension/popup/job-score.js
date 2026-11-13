(() => {
  const $ = id => document.getElementById(id);
  let context = null, generation = 0;
  const clear = () => {
    generation++;
    $("job-score-result").hidden = true;
    $("job-score-status").textContent = "Compare the job description with your working resume or Master CV.";
    $("job-score-compare").disabled = false;
  };
  for (const id of ["resume-choice", "capture-description"]) {
    $(id).addEventListener("input", clear);
    $(id).addEventListener("change", clear);
  }
  const terms = (id, values, empty) => {
    const container = $(id);
    container.replaceChildren();
    for (const value of values) {
      const term = document.createElement("span"); term.className = "score-term";
      term.textContent = value; container.append(term);
    }
    if (!values.length) container.textContent = empty;
  };
  const BANDS = { strong: "Strong fit", good: "Good fit", stretch: "Stretch", low: "Low fit", unknown: "Not enough to tell" };
  const CHECKS = { "work-authorization": "Work authorisation", clearance: "Clearance", citizenship: "Citizenship", onsite: "On-site", relocation: "Relocation", travel: "Travel" };
  const list = value => Array.isArray(value) ? value.filter(item => typeof item === "string" && item) : [];
  const renderFit = (fit, source) => {
    const lines = $("job-fit-lines");
    lines.replaceChildren();
    const add = (label, text, tag = "p") => {
      const line = document.createElement(tag); line.className = "fit-line";
      if (label) { const strong = document.createElement("strong"); strong.textContent = `${label} `; line.append(strong); }
      line.append(document.createTextNode(text)); lines.append(line);
    };
    const chip = $("job-fit-band");
    chip.textContent = BANDS[fit.band] || BANDS.unknown;
    chip.setAttribute("data-band", BANDS[fit.band] ? fit.band : "unknown");
    $("job-fit-reason").textContent = typeof fit.reason === "string" ? fit.reason : "";
    if (fit.band !== "unknown") {
      const missing = list(fit.missing), listed = list(fit.listed), preferred = list(fit.preferredMissing);
      if (missing.length) add("Not in your Master CV:", missing.join(", "));
      if (listed.length) add("Listed without an example:", listed.join(", "));
      if (preferred.length) add("Nice to have, not in your CV:", preferred.join(", "));
      if (Array.isArray(fit.notShown)) {
        const notShown = list(fit.notShown);
        add("", notShown.length ? `Your selected resume leaves out: ${notShown.join(", ")}` : "Your selected resume shows everything your Master CV backs.");
      }
      const years = fit.years;
      if (years?.status === "short") add("", `Asks for ${years.required}+ years; your dated experience covers about ${years.have} years.`);
      else if (years?.status === "unknown" && years.required != null) add("", `Asks for ${years.required}+ years; add dates to your experience to compare.`);
      const degree = fit.degree;
      if (degree?.status === "short" && degree.required) add("", `Asks for a ${degree.required}, ${degree.inProgress ? "only in progress in your education" : "not shown in your education"}`);
      const checks = Array.isArray(fit.checks) ? fit.checks.filter(check => check && typeof check.quote === "string") : [];
      if (checks.length) {
        add("Only you can judge:", "");
        for (const check of checks) add(CHECKS[check.kind] || "Other", `\u201C${check.quote}\u201D`);
      }
    }
    $("job-fit").hidden = false; $("job-keywords").hidden = true; $("job-score-note").hidden = true;
    $("job-score-method").textContent = "Compared with your Master CV";
    $("job-score-status").textContent = source?.title ? `Source: ${source.title}` : "";
    $("job-score-result").hidden = false;
  };
  $("job-score-compare").onclick = async () => {
    if (!context) return;
    const jobDescription = $("capture-description").value.trim();
    clear();
    if (jobDescription.length < 40) {
      $("job-score-status").textContent = "Open or paste the full job description before comparing.";
      return;
    }
    const request = generation;
    const resumeId = $("resume-choice").value || null;
    $("job-score-compare").disabled = true;
    $("job-score-status").textContent = "Comparing job terms…";
    const result = await new Promise(resolve => chrome.runtime.sendMessage({
      type: "job-score", account: context.account, tab: context.job.tabContext, jobDescription, resumeId,
    }, value => resolve(chrome.runtime.lastError ? { ok: false, error: "Connection unavailable. Reopen the extension and try again." } : value)));
    if (generation !== request) return;
    $("job-score-compare").disabled = false;
    if (!result || result.ok === false) {
      $("job-score-status").textContent = result?.error || "Comparison unavailable. Try again.";
      return;
    }
    if (result.fit && typeof result.fit === "object") { renderFit(result.fit, result.source); return; }
    $("job-fit").hidden = true; $("job-keywords").hidden = false; $("job-score-note").hidden = false;
    $("job-score-method").textContent = "Keyword coverage";
    if (!result.totalKeywords || result.score == null) {
      $("job-score-status").textContent = "No recognized job terms. A score would be misleading.";
      return;
    }
    $("job-score-value").textContent = `${result.score}%`;
    $("job-score-source").textContent = result.source.title;
    $("job-score-count").textContent = `${result.matched.length} of ${result.totalKeywords} recognized terms found`;
    $("job-score-meter").setAttribute("aria-valuenow", result.score);
    $("job-score-meter").setAttribute("aria-valuetext", `${result.score}% keyword coverage`);
    $("job-score-fill").style.width = `${result.score}%`;
    terms("job-score-matched", result.matched, "None found in this source.");
    terms("job-score-missing", result.missing, "All recognized terms found.");
    $("job-score-status").textContent = "Based on the saved source and the description shown below.";
    $("job-score-result").hidden = false;
  };
  globalThis.RB_jobScoreUi = { bind(value) { context = value; clear(); } };
})();
