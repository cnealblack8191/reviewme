import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";

const SESSION_COOKIE = "reviewme-session";

function isPublicPath(pathname: string) {
  // Worker links are public by design: the token plus the identity check are the credential.
  return (
    pathname.startsWith("/r/") ||
    pathname === "/login" ||
    pathname === "/login/submit" ||
    pathname === "/logout" ||
    pathname.startsWith("/auth/central") ||
    pathname.startsWith("/api/health")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname === "/eci-logo.png") {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession && !isPublicPath(pathname)) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/(?!health)).*)"]
};
