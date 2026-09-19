import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "reviewme-session";

function isPublicPath(pathname: string) {
  // Worker links are public by design: the token plus the identity check are the credential.
  return (
    pathname.startsWith("/r/") ||
    pathname === "/login" ||
    pathname === "/login/submit" ||
    pathname === "/logout" ||
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
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/(?!health)).*)"]
};
