import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, buildSessionCookieValue, getSessionCookieName, getSessionCookieOptions, homeFor } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  if (!email || !password) return to("/login?error=missing-credentials");

  const user = await authenticate(email, password);
  if (!user) return to("/login?error=invalid-credentials");

  const response = to(homeFor(user));
  response.cookies.set(getSessionCookieName(), buildSessionCookieValue(user.id), getSessionCookieOptions());
  return response;
}
