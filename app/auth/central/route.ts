import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { authenticateFromCentral, buildSessionCookieValue, getSessionCookieName, getSessionCookieOptions, homeFor } from "@/lib/auth";
import { verifyCentralToken } from "@/lib/central-login";
import { recordAudit } from "@/lib/audit";

/** Landing point for central.ecinc.us: /auth/central?token=<JWT> */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(appUrl(path, request), 303);
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return to("/login?error=central-failed");

  const verified = await verifyCentralToken(token);
  if (!verified.ok) {
    await recordAudit({ actorLabel: "central", action: "login.central.rejected", newValue: verified.reason });
    return to("/login?error=central-failed");
  }

  const result = await authenticateFromCentral(verified.claims.email);
  if (!result.ok) {
    await recordAudit({ actorLabel: "central", action: "login.central.no-account", newValue: verified.claims.email });
    return to("/login?error=central-no-account");
  }

  await recordAudit({ actorUserId: result.user.id, actorLabel: "central", action: "login.central", newValue: verified.claims.sub });
  const response = to(homeFor(result.user));
  response.cookies.set(getSessionCookieName(), buildSessionCookieValue(result.user.id), getSessionCookieOptions());
  return response;
}
