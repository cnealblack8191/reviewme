import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runReminders } from "@/lib/reminders";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  return bearer === secret || request.headers.get("x-cron-secret") === secret;
}

export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const force = request.nextUrl.searchParams.get("force") === "1";
  const result = await runReminders(new Date(), { force });
  return NextResponse.json(result);
}

export const GET = POST;
