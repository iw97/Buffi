import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "buffi_beta_access";
const COOKIE_VALUE = "1";

/** When set, /scan, /analyzing, /breakdown and scan-related APIs require unlock (see below). */
function getBetaSecret(): string | undefined {
  const s = process.env.BETA_ACCESS_SECRET?.trim();
  return s || undefined;
}

function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+/g, "/");
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

function isProtectedPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (p === "/scan" || p === "/analyzing" || p === "/breakdown") return true;
  if (
    p === "/api/scan" ||
    p === "/api/scan-tag" ||
    p === "/api/better-alternatives" ||
    p === "/api/price-lookup" ||
    p === "/api/secondhand"
  ) {
    return true;
  }
  return false;
}

function hasBetaCookie(request: NextRequest): boolean {
  return request.cookies.get(COOKIE)?.value === COOKIE_VALUE;
}

function setBetaCookie(response: NextResponse): void {
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set(COOKIE, COOKIE_VALUE, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90
  });
}

export function middleware(request: NextRequest) {
  const secret = getBetaSecret();
  if (!secret) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  const pathname = url.pathname;
  const betaParam = url.searchParams.get("beta");

  if (betaParam === secret) {
    url.searchParams.delete("beta");
    const clean = url.searchParams.toString();
    const dest = clean ? `${url.pathname}?${clean}` : url.pathname;
    const res = NextResponse.redirect(new URL(dest, request.url));
    setBetaCookie(res);
    return res;
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (hasBetaCookie(request)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "beta_required" }, { status: 403 });
  }

  return NextResponse.redirect(new URL("/waitlist", request.url));
}

export const config = {
  matcher: [
    "/scan",
    "/analyzing",
    "/breakdown",
    "/api/scan",
    "/api/scan-tag",
    "/api/better-alternatives",
    "/api/price-lookup",
    "/api/secondhand"
  ]
};
