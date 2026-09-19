import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isOffice } from "@/lib/types";
import { buildReviewPdf, type PdfAudience } from "@/lib/review-pdf";

export async function GET(request: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isOffice(user)) return new Response("Forbidden", { status: 403 });

  const { reviewId } = await params;
  const audience: PdfAudience = request.nextUrl.searchParams.get("copy") === "employee" ? "employee" : "office";
  const download = request.nextUrl.searchParams.get("download") === "1";
  const result = await buildReviewPdf(reviewId, audience);
  if (!result) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${result.filename}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
