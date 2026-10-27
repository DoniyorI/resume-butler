// How to read a job and spot a submitted application on each supported site.
// Rules are data so a site that changes its pages needs only an edit here
// (later: fetched from the app, so fixes ship without a new extension version).
//
// Per site:
//   hosts         hostnames the rules apply to
//   jobId(url)    the posting's ID, which links the posting, form and
//                 confirmation pages of one job
//   title, location, description   CSS selectors, used when the page has no
//                 JSON-LD JobPosting (job-reader.js tries that first)
//   company(doc, url)  the employer's name
//   submitButton  CSS selector of the submit button
//   successUrl    the URL after a successful submit, if the site changes it
//   successText   text that appears after a successful submit
//
// Checked against live postings on 2026-10-27.

const SUCCESS_TEXT =
  /thank(s| you) for (applying|your application)|application (has been |was )?(submitted|received)|we('ve| have) received your application/i;

// "Job Application for <role> at <company>" (Greenhouse page titles)
const companyAfterAt = (text) => text?.match(/\sat\s+(.+?)\s*$/)?.[1] || "";

globalThis.RB_SITES = [
  {
    id: "greenhouse",
    hosts: ["job-boards.greenhouse.io", "boards.greenhouse.io"],
    // Companies embed the application form in an iframe on their own site
    isEmbeddedForm: (url) => url.hostname === "boards.greenhouse.io" && url.pathname.startsWith("/embed/"),
    // /<board>/jobs/<id> on job boards; ?token=<id> on embedded forms
    jobId: (url) => url.pathname.match(/\/jobs\/(\d+)/)?.[1] || url.searchParams.get("token") || null,
    title: ".job__title h1, h1.app-title, h1",
    location: ".job__location, .location",
    description: ".job__description, #content",
    company: (doc, url) =>
      companyAfterAt(doc.title) ||
      doc
        .querySelector(".company-name")
        ?.textContent.replace(/^\s*at\s+/i, "")
        .trim() ||
      url.pathname.split("/")[1] ||
      url.searchParams.get("for") ||
      "",
    submitButton: 'button[type="submit"], input[type="submit"], #submit_app',
    successUrl: /\/confirmation\/?$/,
    successText: SUCCESS_TEXT,
  },
  {
    id: "lever",
    hosts: ["jobs.lever.co"],
    // /<company>/<uuid>, /<uuid>/apply and /<uuid>/thanks
    jobId: (url) => url.pathname.match(/\/([0-9a-f]{8}-[0-9a-f-]{27})/i)?.[1] || null,
    title: ".posting-headline h2",
    location: ".posting-categories .location, .posting-category.location",
    description: '[data-qa="job-description"], .section-wrapper.page-full-width',
    // "<company> - <role>"
    company: (doc) => doc.title.split(" - ")[0]?.trim() || "",
    roleFromTitle: (doc) => doc.title.split(" - ").slice(1).join(" - ").trim(),
    submitButton: '#btn-submit, button[type="submit"]',
    successUrl: /\/thanks\/?$/,
    successText: SUCCESS_TEXT,
  },
  {
    id: "ashby",
    hosts: ["jobs.ashbyhq.com"],
    // /<company>/<uuid> and /<uuid>/application; a single-page app
    jobId: (url) => url.pathname.match(/\/([0-9a-f]{8}-[0-9a-f-]{27})/i)?.[1] || null,
    title: "h1",
    location: "",
    description: "",
    // "<role> @ <company>"
    company: (doc) => doc.title.split(" @ ").slice(-1)[0]?.trim() || "",
    roleFromTitle: (doc) => doc.title.split(" @ ").slice(0, -1).join(" @ ").trim(),
    submitButton: 'button[type="submit"], button.ashby-application-form-submit-button',
    successUrl: null,
    successText: SUCCESS_TEXT,
  },
];
