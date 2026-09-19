import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isOffice } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { buildMergedPdf } from "@/lib/review-pdf";
import { recordAudit } from "@/lib/audit";

/** Merged office PDF: ?reviewer=<userId> for one reviewer's crew, none for the whole company. ?drafts=1 includes unfinished reviews. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isOffice(user)) return new Response("Forbidden", { status: 403 });

  const sp = request.nextUrl.searchParams;
  const period = sp.get("period")
    ? await prisma.reviewPeriod.findUnique({ where: { id: sp.get("period")! } })
    : await prisma.reviewPeriod.findFirst({ where: { closedAt: null }, orderBy: { opensAt: "desc" } });
  if (!period) return new Response("No review period", { status: 404 });

  const result = await buildMergedPdf({
    periodId: period.id,
    supervisorId: sp.get("reviewer") || undefined,
    includeDrafts: sp.get("drafts") === "1"
  });
  if (!result) return new Response("Not found", { status: 404 });

  await recordAudit({ actorUserId: user.id, actorLabel: "office", action: "export.pdf", newValue: `${result.filename} · ${result.count} reviews` });

  return new Response(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${sp.get("download") === "1" ? "attachment" : "inline"}; filename="${result.filename}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
