import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { HOME_PATH, isAuthPath, isPublicPath } from "@/lib/redirects";

export async function middleware(request) {
  const { response, signedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && !isPublicPath(pathname) && !isAuthPath(pathname)) {
    return redirectWithCookies(request, response, "/login", { next: pathname + search });
  }

  if (signedIn && isAuthPath(pathname)) {
    return redirectWithCookies(request, response, HOME_PATH);
  }

  return response;
}

// Redirect while keeping any refreshed session cookies from updateSession
function redirectWithCookies(request, response, pathname, params = {}) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = new URLSearchParams(params).toString();
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    // Everything except Next.js internals, static files and /api. Routes check
    // the user themselves (and refresh the session cookies when needed), so
    // running here too would only add a second auth round trip per request.
    "/((?!api/|_next/static|_next/image|favicon.ico|image/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
  ],
};
