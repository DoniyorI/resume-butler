import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { HOME_PATH, isAuthPath, isPublicPath } from "@/lib/redirects";

export async function middleware(request) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // API routes do their own auth and return 401 instead of redirecting
  if (pathname.startsWith("/api/")) return response;

  if (!user && !isPublicPath(pathname) && !isAuthPath(pathname)) {
    return redirectWithCookies(request, response, "/login", { next: pathname + search });
  }

  if (user && isAuthPath(pathname)) {
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
    // Everything except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|image/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
  ],
};
