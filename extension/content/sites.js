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
//   submitText    optional: the button's text must match (default: contains "submit")
//   successUrl    the URL after a successful submit, if the site changes it
//   successText   text that appears after a successful submit
//   successRoot   optional: CSS selector of where successText must appear
//
// Checked against live postings on 2026-10-27 (LinkedIn's signed-in Easy
// Apply markup isn't publicly visible, so its selectors are best-effort with
// the page title and JSON-LD as fallbacks).

// LinkedIn Easy Apply's dialog after submitting: "Your application was sent to <company>!"
const LINKEDIN_SUCCESS_TEXT = /your application was sent|application sent|application submitted/i;

const SUCCESS_TEXT =
  /thank(s| you) for (applying|your application)|application (has been |was )?(submitted|received)|we('ve| have) received your application/i;

const notLinkedIn = (name) => (name && !/^linkedin( jobs)?$/i.test(name.trim()) ? name.trim() : "");

// "Job Application for <role> at <company>" (Greenhouse page titles)
const companyAfterAt = (text) => text?.match(/\sat\s+(.+?)\s*$/)?.[1] || "";

globalThis.RB_SITES = [
  {
    id: "linkedin",
    hosts: ["www.linkedin.com"],
    // /jobs/view/<id>/, /jobs/view/<slug>-<id> (signed out), or ?currentJobId=<id>
    // on search and collection pages; a single-page app
    jobId: (url) =>
      url.pathname.match(/^\/jobs\/view\/(?:[^/]*-)?(\d+)/)?.[1] ||
      (url.pathname.startsWith("/jobs/") ? url.searchParams.get("currentJobId") : null) ||
      null,
    postingUrl: (jobId) => `https://www.linkedin.com/jobs/view/${jobId}/`,
    title: [
      ".job-details-jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      ".top-card-layout__title",
    ].join(", "),
    location: [
      ".job-details-jobs-unified-top-card__primary-description-container .tvm__text",
      ".job-details-jobs-unified-top-card__bullet",
      ".topcard__flavor--bullet",
    ].join(", "),
    description:
      "#job-details, .jobs-description__content, .jobs-box__html-content, .show-more-less-html__markup",
    company: (doc, url) =>
      notLinkedIn(
        doc
          .querySelector(
            ".job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .topcard__org-name-link"
          )
          ?.textContent.trim()
      ) ||
      // The Easy Apply dialog's heading: "Apply to <company>"
      [...doc.querySelectorAll("h1, h2, h3")]
        .map((el) => el.textContent.trim().match(/^Apply to (.+)$/)?.[1])
        .find(Boolean) ||
      // After submitting: /jobs/view/<id>/post-apply/?companyName=<company>
      url?.searchParams.get("companyName") ||
      // Posting page titles: "<role> | <company> | LinkedIn" or "<role> at <company> — <place> | LinkedIn Jobs"
      (url?.pathname.startsWith("/jobs/view/")
        ? notLinkedIn(doc.title.replace(/^\(\d+\)\s*/, "").split(" | ")[1]) ||
          notLinkedIn(companyAfterAt(doc.title.split(" — ")[0]))
        : "") ||
      "",
    // Search pages are titled after the search, not the job
    roleFromTitle: (doc) =>
      window.location.pathname.startsWith("/jobs/view/")
        ? doc.title
            .replace(/^\(\d+\)\s*/, "")
            .split(" | ")[0]
            .split(" at ")[0]
            .trim()
        : "",
    // The new Easy Apply has no aria-label on it: a plain "Submit application" button
    submitButton: 'button[aria-label*="Submit application"], button',
    submitText: /^\s*submit application\b/i,
    // After submitting, LinkedIn moves to /jobs/view/<id>/post-apply/
    successUrl: /^\/jobs\/view\/\d+\/post-apply/,
    // The Easy Apply dialog, which says "Your application was sent to <company>"
    successRoot: '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog, .artdeco-modal',
    successText: LINKEDIN_SUCCESS_TEXT,
  },
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
