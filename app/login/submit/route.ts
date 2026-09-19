import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { authenticate, buildSessionCookieValue, getSessionCookieName, getSessionCookieOptions, homeFor } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  const to = (path: string) => NextResponse.redirect(appUrl(path, request), 303);

  if (!email || !password) return to("/login?error=missing-credentials");

  const result = await authenticate(email, password);
  if (!result.ok) return to(`/login?error=${result.reason}`);

  const response = to(homeFor(result.user));
  response.cookies.set(getSessionCookieName(), buildSessionCookieValue(result.user.id), getSessionCookieOptions());
  return response;
}
