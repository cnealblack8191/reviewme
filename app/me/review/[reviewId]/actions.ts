"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireForeman } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidRating, submitSupervisorSide } from "@/lib/reviews";

async function loadOwnedReview(reviewId: string, userId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { template: { include: { criteria: true } } }
  });
  if (!review || review.supervisorId !== userId) return null;
  if (review.supervisorStatus === "SUBMITTED") return null;
  return review;
}

async function persistAnswers(formData: FormData, userId: string) {
  const reviewId = String(formData.get("reviewId") ?? "");
  const review = await loadOwnedReview(reviewId, userId);
  if (!review) return null;

  for (const criterion of review.template.criteria) {
    const raw = formData.get(`rating:${criterion.id}`);
    const rating = raw ? Number(raw) : null;
    const comment = String(formData.get(`comment:${criterion.id}`) ?? "").trim() || null;
    if (rating != null && !isValidRating(rating)) continue;
    await prisma.reviewAnswer.upsert({
      where: { reviewId_criterionId_side: { reviewId, criterionId: criterion.id, side: "SUPERVISOR" } },
      update: { rating, comment },
      create: { reviewId, criterionId: criterion.id, side: "SUPERVISOR", rating, comment }
    });
  }

  const overallRaw = formData.get("overallRating");
  const overallRating = overallRaw ? Number(overallRaw) : null;
  await prisma.review.update({
    where: { id: reviewId },
    data: {
      overallRating: overallRating != null && isValidRating(overallRating) ? overallRating : null,
      overallComments: String(formData.get("overallComments") ?? "").trim() || null,
      goals: String(formData.get("goals") ?? "").trim() || null,
      supervisorStatus: "IN_PROGRESS"
    }
  });

  return review;
}

export async function saveSupervisorAnswersAction(formData: FormData) {
  const user = await requireForeman();
  const review = await persistAnswers(formData, user.id);
  if (review) revalidatePath(`/me/review/${review.id}`);
}

export async function submitSupervisorAction(formData: FormData) {
  const user = await requireForeman();
  const review = await persistAnswers(formData, user.id);
  if (!review) return;

  const answers = await prisma.reviewAnswer.count({ where: { reviewId: review.id, side: "SUPERVISOR", rating: { not: null } } });
  const fresh = await prisma.review.findUniqueOrThrow({ where: { id: review.id }, select: { overallRating: true } });
  if (answers < review.template.criteria.length || fresh.overallRating == null) {
    // Incomplete: leave it in progress. The page shows what is missing on reload.
    revalidatePath(`/me/review/${review.id}`);
    return;
  }

  await submitSupervisorSide(review.id, user.id);
  redirect("/me");
}
