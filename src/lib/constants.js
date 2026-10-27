// Single source of truth for application statuses. The database enforces the
// same list (applications_status_known in migration 004).
export const APPLICATION_STATUSES = [
  "Applied",
  "Reached Out",
  "Pending",
  "Interviewed",
  "Offered",
  "Rejected",
  "Withdrew",
];

// Forward progression used when email sync decides whether a status moved on.
// Rejected and Withdrew are terminal and handled separately.
export const STATUS_PROGRESSION = ["Applied", "Reached Out", "Pending", "Interviewed", "Offered"];

// Fill color per status, shared by badges, the dashboard and the Sankey chart
export const STATUS_COLORS = {
  Applied: "#B5DCF2",
  "Reached Out": "#B5F2E0",
  Pending: "#FFFACD",
  Interviewed: "#F3F5A3",
  Offered: "#D8F1AE",
  Rejected: "#F2B5B5",
  Withdrew: "#D0B5F2",
};

export const DEFAULT_STATUS = "Applied";

// Keep in sync with the "brand" color in tailwind.config.js (for charts and other JS-drawn UI)
export const BRAND_COLOR = "#559F87";

// New passwords (sign-up and reset): at least this many characters
export const MIN_PASSWORD_LENGTH = 8;
