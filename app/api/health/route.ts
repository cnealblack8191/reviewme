import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const time = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, app: "reviewme", database: "ok", time });
  } catch {
    return NextResponse.json({ ok: false, app: "reviewme", database: "unreachable", time }, { status: 503 });
  }
}
