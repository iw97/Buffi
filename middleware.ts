import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_ROUTES = ["/scan", "/profile", "/saves"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

export function middleware(request: NextRequest) {
  console.log("middleware hit", request.nextUrl.pathname);
  const { pathname, search } = request.nextUrl;
  if (isProtectedPath(pathname)) {
    const hasAuthCookie = request.cookies.get("buffi_auth")?.value === "1";
    if (!hasAuthCookie) {
      const signInUrl = request.nextUrl.clone();
      signInUrl.pathname = "/signin";
      signInUrl.search = `?${new URLSearchParams({ returnTo: pathname + search }).toString()}`;
      return NextResponse.redirect(signInUrl);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*"
};
