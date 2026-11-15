// Application-form URLs where reviewed autofill is offered. The worker uses this
// module; the popup is a classic script and keeps a copy of the same rules
// (tests/extension-autofill-urls.test.mjs asserts the two agree). The content
// adapters re-check the page's own URL independently.
const LEVER_PATH = /^\/[^/]+\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\/apply\/?$/i;
const ASHBY_PATH = /^\/[A-Za-z0-9._-]{1,100}\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\/application\/?$/i;
const GREENHOUSE_JOB_PATH = /^\/[A-Za-z0-9_-]{1,100}\/jobs\/\d{1,20}\/?$/;

export function autofillPlatform(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.origin === "https://jobs.lever.co") return LEVER_PATH.test(url.pathname) ? "lever" : null;
    if (url.origin === "https://jobs.ashbyhq.com") return ASHBY_PATH.test(url.pathname) ? "ashby" : null;
    if (url.origin !== "https://job-boards.greenhouse.io") return null;
    if (GREENHOUSE_JOB_PATH.test(url.pathname)) return "greenhouse";
    if (url.pathname !== "/embed/job_app") return null;
    const boards = url.searchParams.getAll("for"), tokens = url.searchParams.getAll("token");
    return boards.length === 1 && /^[A-Za-z0-9_-]{1,100}$/.test(boards[0]) && tokens.length === 1 && /^\d{1,20}$/.test(tokens[0]) ? "greenhouse" : null;
  } catch { return null; }
}

export const supportedAutofillUrl = value => autofillPlatform(value) !== null;
