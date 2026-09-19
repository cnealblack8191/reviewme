"use server";

import { requireReviewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidRating, submitSupervisorSide } from "@/lib/reviews";
import type { SupervisorDraft } from "@/lib/supervisor-draft";

async function loadOwnedReview(reviewId: string, userId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { template: { include: { criteria: { orderBy: { sortOrder: "asc" } } } } }
  });
  if (!review || review.supervisorId !== userId) return null;
  if (review.supervisorStatus === "SUBMITTED") return null;
  return review;
}

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function persist(review: NonNullable<Awaited<ReturnType<typeof loadOwnedReview>>>, draft: SupervisorDraft) {
  for (const criterion of review.template.criteria) {
    const answer = draft.answers?.[criterion.id];
    const rating = typeof answer?.rating === "number" && isValidRating(answer.rating) ? answer.rating : null;
    const comment = clean(answer?.comment, 1000) || null;
    await prisma.reviewAnswer.upsert({
      where: { reviewId_criterionId_side: { reviewId: review.id, criterionId: criterion.id, side: "SUPERVISOR" } },
      update: { rating, comment },
      create: { reviewId: review.id, criterionId: criterion.id, side: "SUPERVISOR", rating, comment }
    });
  }
  const updated = await prisma.review.update({
    where: { id: review.id },
    data: {
      overallRating: typeof draft.overallRating === "number" && isValidRating(draft.overallRating) ? draft.overallRating : null,
      overallComments: clean(draft.overallComments) || null,
      goals: clean(draft.goals) || null,
      supervisorStatus: "IN_PROGRESS"
    },
    select: { updatedAt: true }
  });
  return updated.updatedAt;
}

export async function saveSupervisorDraft(reviewId: string, draft: SupervisorDraft): Promise<{ ok: true; savedAt: number } | { ok: false }> {
  const user = await requireReviewer();
  const review = await loadOwnedReview(reviewId, user.id);
  if (!review) return { ok: false };
  const savedAt = await persist(review, draft);
  return { ok: true, savedAt: savedAt.getTime() };
}

export async function submitSupervisorDraft(reviewId: string, draft: SupervisorDraft): Promise<{ ok: true } | { ok: false; missing: string[] }> {
  const user = await requireReviewer();
  const review = await loadOwnedReview(reviewId, user.id);
  if (!review) return { ok: false, missing: ["This review is no longer open on your side"] };
  await persist(review, draft);

  const missing: string[] = [];
  for (const c of review.template.criteria) {
    const r = draft.answers?.[c.id]?.rating;
    if (typeof r !== "number" || !isValidRating(r)) missing.push(c.labelEn);
  }
  if (typeof draft.overallRating !== "number" || !isValidRating(draft.overallRating)) missing.push("Overall rating");
  if (missing.length) return { ok: false, missing };

  await submitSupervisorSide(review.id, user.id);
  return { ok: true };
}
