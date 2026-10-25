// Pages anyone can open. Everything else (except /api, which checks auth per
// route) requires a signed-in user.
export const PUBLIC_PATHS = ["/about", "/contact", "/auth/callback"];

// Sign-in pages: signed-out only, signed-in users are sent to the app
export const AUTH_PATHS = ["/login", "/register", "/forgot-password"];

export const HOME_PATH = "/";

function matches(pathname, paths) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const isPublicPath = (pathname) => matches(pathname, PUBLIC_PATHS);
export const isAuthPath = (pathname) => matches(pathname, AUTH_PATHS);

// Only allow same-site relative paths after sign-in ("//evil.com" and
// "/\evil.com" are treated as other origins by browsers).
export function safeNextPath(value, fallback = HOME_PATH) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
