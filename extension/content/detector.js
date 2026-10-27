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

(() => {
  const site = globalThis.RB_SITES.find((s) => s.hosts.includes(window.location.hostname));
  if (!site) return;
  // Only the top-level page, or Greenhouse's embedded form, which companies
  // run in an iframe on their own careers pages (see isEmbeddedForm in sites.js)
  const framed = window !== window.top;
  if (framed && !site.isEmbeddedForm?.(new URL(window.location.href))) return;

  const CHECK_INTERVAL_MS = 1500;
  const reportedKeys = new Set();
  let lastUrl = "";
  let submitClicked = false;
  let successTextBeforeClick = false;

  const send = (message) =>
    new Promise((resolve) =>
      chrome.runtime.sendMessage(message, (reply) => resolve(chrome.runtime.lastError ? null : reply))
    );

  const keyFor = (jobId) => `${site.id}:${jobId}`;
  const successTextShowing = () => site.successText.test(document.body?.innerText || "");

  // Save what the posting says, so the confirmation page (which shows little) can use it
  function capture() {
    const job = globalThis.RB_readJob(site);
    if (job) send({ type: "job-seen", key: keyFor(job.jobId), job });
  }

  // Prefer what was read on the posting; fill gaps from this page
  function merge(saved, current) {
    if (!saved) return current;
    if (!current) return saved;
    const merged = { ...current };
    for (const field of ["company", "role", "location", "url", "description"]) {
      if (saved[field] && (field === "description" || field === "url" || !merged[field]))
        merged[field] = saved[field];
    }
    return merged;
  }

  async function onSubmitted() {
    const jobId = site.jobId(new URL(window.location.href));
    if (!jobId) return;
    const key = keyFor(jobId);
    if (reportedKeys.has(key)) return;
    reportedKeys.add(key);

    const job = merge(await send({ type: "job-lookup", key }), globalThis.RB_readJob(site));
    if (!job?.company) return;
    const result = await send({ type: "submitted", key, job });
    globalThis.RB_showResult(result, job);
  }

  function check() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      capture();
    }
    if (site.successUrl?.test(window.location.pathname)) {
      onSubmitted();
    } else if (submitClicked && !successTextBeforeClick && successTextShowing()) {
      onSubmitted();
    }
  }

  // Note the submit click (capture phase, before the site's own handlers)
  document.addEventListener(
    "click",
    (event) => {
      // Only real clicks: the page's scripts can't fake a submission
      if (!event.isTrusted) return;
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest(site.submitButton) || target?.closest("button");
      if (!button || !/submit/i.test(button.textContent || button.value || "")) return;
      successTextBeforeClick = successTextShowing();
      submitClicked = true;
      capture();
      // Lets the background worker trust the confirmation that follows (often on a new page)
      const jobId = site.jobId(new URL(window.location.href));
      if (jobId) send({ type: "submit-clicked", key: keyFor(jobId) });
      const job = globalThis.RB_readJob(site);
      if (job) globalThis.RB_showTracking(job);
    },
    true
  );

  // The popup asks what job this tab shows (for "I applied to this")
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "read-job" || window !== window.top) return false;
    sendResponse(globalThis.RB_readJob(site));
    return false;
  });

  // Single-page sites change the page without loading a new one
  let pending = null;
  new MutationObserver(() => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      check();
    }, 500);
  }).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(check, CHECK_INTERVAL_MS);
  check();
})();
