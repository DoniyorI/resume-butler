// Runs on supported job sites (content/sites.js). Remembers each posting it
// sees, and when an application is submitted, reports it with the posting's
// details to the background worker, which adds it to Resume Butler
// automatically. A small notice says "Tracking application" when the submit
// button is clicked, then confirms with an undo.
//
// A submission counts when:
//   - the site moves to its confirmation URL (Greenhouse /confirmation, Lever /thanks), or
//   - after a click on the submit button, a "thanks for applying" message
//     appears that wasn't on the page before the click (Ashby, and the others
//     as a fallback). Checking before the click keeps a job description that
//     happens to mention applying from counting.
// The background worker adds it automatically only if the submit button was
// clicked for that job; otherwise the notice asks "Did you apply?" first.

(() => {
  const site = globalThis.RB_SITES.find((s) => s.hosts.includes(window.location.hostname));
  if (!site) return;
  // Only the top-level page, or Greenhouse's embedded form, which companies
  // run in an iframe on their own careers pages (see isEmbeddedForm in sites.js)
  const framed = window !== window.top;
  if (framed && !site.isEmbeddedForm?.(new URL(window.location.href))) return;

  const CHECK_INTERVAL_MS = 1500;
  console.debug("[Resume Butler] watching for applications on", site.id);
  const reportedKeys = new Set();
  let lastUrl = "";
  // The job whose submit button was clicked, and whether the success text was already showing
  let clickedJobId = null;
  let successTextBeforeClick = false;

  // After the extension is reloaded or updated, this copy of the script is cut
  // off from it ("Extension context invalidated"): stop, and let the fresh copy
  // the background worker injects take over
  // Only the newest copy runs, if an injected copy shares the page with an older one
  const instance = Symbol("detector");
  globalThis.RB_detector = instance;
  const connected = () => globalThis.RB_detector === instance && Boolean(globalThis.chrome?.runtime?.id);
  const send = (message) =>
    new Promise((resolve) => {
      if (!connected()) {
        stop();
        return resolve(null);
      }
      try {
        chrome.runtime.sendMessage(message, (reply) => resolve(chrome.runtime.lastError ? null : reply));
      } catch {
        stop();
        resolve(null);
      }
    });

  const keyFor = (jobId, at = window.location) => {
    const url = new URL(at.href || at);
    const board = site.id === "greenhouse" ? (url.searchParams.get("for") || url.pathname.split("/").filter(Boolean)[0]) : url.hostname;
    return `${site.id}:${board}:${jobId}`;
  };
  // Shown in the page's DevTools console, to see why something was or wasn't tracked
  const log = (...args) => console.debug("[Resume Butler]", ...args);
  // Only inside the site's form or dialog when it names one, so text elsewhere on the page can't count
  const successTextShowing = () => {
    const roots = site.successRoot ? [...document.querySelectorAll(site.successRoot)] : [document.body];
    return roots.some((root) => site.successText.test(root?.innerText || ""));
  };
  const currentJobId = () => site.jobId(new URL(window.location.href));

  // Save what the posting says, so the confirmation page (which shows little) can use it
  let lastCapture = "";
  function capture() {
    if (site.successUrl?.test(window.location.pathname)) return;
    const job = globalThis.RB_readJob(site);
    if (!job) return;
    const key = keyFor(job.jobId), signature = JSON.stringify({ key, job });
    if (signature === lastCapture) return;
    lastCapture = signature;
    send({ type: "job-seen", key, job });
  }

  // Prefer what was read on the posting; fill gaps from this page
  function merge(saved, current) {
    if (!saved) return current;
    if (!current) return saved;
    const merged = { ...current };
    for (const field of [
      "company",
      "role",
      "location",
      "url",
      "description",
      "salary",
      "employmentType",
      "workplaceType",
    ]) {
      if (saved[field] && (["description", "url", "salary"].includes(field) || !merged[field]))
        merged[field] = saved[field];
    }
    return merged;
  }

  // `at`: the confirmation's URL, when the page is only passing through it
  async function onSubmitted(jobId = currentJobId(), at = window.location) {
    if (!jobId) return;
    const key = keyFor(jobId, at);
    if (reportedKeys.has(key)) return;
    reportedKeys.add(key);

    const job = merge(await send({ type: "job-lookup", key }), globalThis.RB_readJob(site, document, at));
    log("submission detected", key, job);
    if (!job?.company) return log("skipped: no company name found on this page");
    const result = await send({ type: "submitted", key, job });
    log("result", result);
    globalThis.RB_showResult(result, job, key);
  }

  // After a submit click, what the page shows, for the console (once per change)
  let lastDiagnosis = "";
  function diagnose() {
    if (!clickedJobId) return;
    const dialogs = site.successRoot ? [...document.querySelectorAll(site.successRoot)] : [];
    const text = dialogs.map((el) => (el.innerText || "").replace(/\s+/g, " ").slice(0, 120)).join(" / ");
    const diagnosis = `${window.location.pathname} | ${dialogs.length} dialog(s): ${text || "-"}`;
    if (diagnosis !== lastDiagnosis) log("after submit:", (lastDiagnosis = diagnosis));
  }

  function check() {
    if (!connected()) return stop();
    diagnose();
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      // Moved to another job: a click on the last one no longer counts
      if (clickedJobId && currentJobId() !== clickedJobId) clickedJobId = null;
    }
    // Detail panels can finish loading after the SPA URL changes.
    capture();
    if (site.successUrl?.test(window.location.pathname)) {
      onSubmitted();
    } else if (clickedJobId && !successTextBeforeClick && successTextShowing()) {
      onSubmitted(clickedJobId);
    }
  }

  // Note the submit click (capture phase, before the site's own handlers)
  function onClick(event) {
    // Only real clicks: the page's scripts can't fake a submission
    if (!event.isTrusted) return;
    // The real target, even inside a shadow root (where event.target is only its host)
    const button = event
      .composedPath()
      .find((node) => node instanceof Element && node.matches(site.submitButton));
    const label = button?.ariaLabel || button?.textContent || button?.value || "";
    if (!button || !(site.submitText || /submit/i).test(label)) return;
    const jobId = currentJobId();
    log("submit clicked", jobId);
    if (!jobId) return;
    successTextBeforeClick = successTextShowing();
    clickedJobId = jobId;
    capture();
    // Lets the background worker trust the confirmation that follows (often on a new page)
    send({ type: "submit-clicked", key: keyFor(jobId) });
    globalThis.RB_showTracking(globalThis.RB_readJob(site) || {});
  }
  document.addEventListener("click", onClick, true);

  // LinkedIn shows its confirmation URL (/jobs/view/<id>/post-apply/) only for
  // a moment before going back to the search page, too briefly for polling:
  // catch it as the page navigates there
  function onNavigate(event) {
    const url = new URL(event.destination.url);
    if (clickedJobId) log("navigating to", url.pathname);
    if (url.origin === window.location.origin && site.successUrl?.test(url.pathname)) {
      log("confirmation page", url.pathname);
      onSubmitted(site.jobId(url), url);
    }
  }
  globalThis.navigation?.addEventListener("navigate", onNavigate);

  // The popup asks what job this tab shows (for "I applied to this")
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || window !== window.top || !connected()) return false;
    // The background worker saw the site's own submit request succeed (LinkedIn Easy Apply)
    if (message?.type === "site-submitted") {
      log("submit request succeeded");
      onSubmitted(clickedJobId || currentJobId());
      return false;
    }
    if (message?.type !== "read-job") return false;
    sendResponse(globalThis.RB_readJob(site));
    return false;
  });

  // Single-page sites change the page without loading a new one
  let pending = null;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      check();
    }, 500);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const interval = setInterval(check, CHECK_INTERVAL_MS);

  function stop() {
    clearInterval(interval);
    clearTimeout(pending);
    observer.disconnect();
    document.removeEventListener("click", onClick, true);
    globalThis.navigation?.removeEventListener("navigate", onNavigate);
  }
  check();
})();
