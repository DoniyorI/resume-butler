// Pages anyone can open. Everything else (except /api, which checks auth per
// route) requires a signed-in user.
export const PUBLIC_PATHS = ["/about", "/contact", "/privacy", "/auth/callback"];

// Sign-in pages: signed-out only, signed-in users are sent to the app
export const AUTH_PATHS = ["/login", "/register", "/forgot-password"];

export const HOME_PATH = "/";

function matches(pathname, paths) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const isPublicPath = (pathname) => matches(pathname, PUBLIC_PATHS);
export const isAuthPath = (pathname) => matches(pathname, AUTH_PATHS);

// Only allow same-site paths after sign-in. Prefix checks alone aren't enough:
// browsers treat "//evil.com", "/\evil.com" and "/\t/evil.com" (tabs and
// newlines are stripped) as other origins. So reject control characters and
// backslashes, then resolve against a dummy origin and require it to match.
const DUMMY_ORIGIN = "http://same-site.invalid";

export function safeNextPath(value, fallback = HOME_PATH) {
  if (typeof value !== "string" || !value.startsWith("/") || /[\x00-\x1f\x7f\\]/.test(value)) {
    return fallback;
  }
  try {
    const url = new URL(value, DUMMY_ORIGIN);
    // "/.//evil.com" normalizes to the protocol-relative "//evil.com"
    if (url.origin !== DUMMY_ORIGIN || url.pathname.startsWith("//")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
