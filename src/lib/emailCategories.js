// Kinds of email a scan can turn into application suggestions, the status each
// implies, and whether the scan looks for it by default. Shared by the scan
// options UI and the server-side classifier.
export const EMAIL_CATEGORIES = [
  { id: "application_received", label: "Application confirmations", status: "Applied", defaultOn: true },
  { id: "interview", label: "Interview invites", status: "Interviewed", defaultOn: true },
  { id: "assessment", label: "Assessments & coding challenges", status: "Interviewed", defaultOn: true },
  { id: "offer", label: "Offers", status: "Offered", defaultOn: true },
  { id: "rejection", label: "Rejections", status: "Rejected", defaultOn: true },
  // Mostly mass mail, so opt-in
  { id: "recruiter_outreach", label: "Recruiter outreach", status: "Reached Out", defaultOn: false },
];

export const CATEGORY_LABELS = Object.fromEntries(EMAIL_CATEGORIES.map((c) => [c.id, c.label]));

export const DEFAULT_SCAN_CATEGORIES = EMAIL_CATEGORIES.filter((c) => c.defaultOn).map((c) => c.id);
