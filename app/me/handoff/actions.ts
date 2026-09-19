"use server";

import { redirect } from "next/navigation";
import { clearSession, requireReviewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issueLink } from "@/lib/links";

export async function handoffAction(formData: FormData) {
  const user = await requireReviewer();
  const reviewId = String(formData.get("reviewId") ?? "");
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || review.supervisorId !== user.id || review.employeeStatus === "SUBMITTED") return;

  const { token } = await issueLink({ reviewId, kind: "SELF_EVAL", channel: "HANDOFF", createdById: user.id });
  await clearSession();
  redirect(`/r/${token}`);
}
