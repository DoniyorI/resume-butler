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
