import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { getSessionCookieName } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(appUrl("/login", request), 303);
  response.cookies.delete(getSessionCookieName());
  return response;
}

export const POST = GET;
