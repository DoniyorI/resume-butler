// Links saved by users, email sync or AI must only ever be http(s): a
// "javascript:" URL in an href runs script when clicked.

// Returns the URL if it is http(s), otherwise null. Use before rendering an href.
export function safeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

// Normalizes user input before saving: adds https:// when no scheme is given
// and drops anything that isn't http(s).
export function normalizeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return safeHttpUrl(withScheme) || "";
}
