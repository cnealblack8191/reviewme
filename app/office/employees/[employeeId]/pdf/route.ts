import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isOffice } from "@/lib/types";
import { buildEmployeeFilePdf } from "@/lib/review-pdf";
import { recordAudit } from "@/lib/audit";

/** The employee's whole review file as one PDF. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isOffice(user)) return new Response("Forbidden", { status: 403 });
  const { employeeId } = await params;
  const result = await buildEmployeeFilePdf(employeeId);
  if (!result) return new Response("Not found", { status: 404 });
  await recordAudit({ actorUserId: user.id, actorLabel: "office", action: "export.employee-file", newValue: `${result.filename} · ${result.count} reviews` });
  return new Response(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${result.filename}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
