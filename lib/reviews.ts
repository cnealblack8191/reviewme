/**
 * Review lifecycle. Both sides progress on their own until both are SUBMITTED,
 * then the review is PENDING_OFFICE. From there the office approves or sends
 * back; the supervisor marks it DISCUSSED; the sign link goes out; the worker
 * signs or declines; the office closes.
 */
import type { ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

export const RATING_MIN = 1;
export const RATING_MAX = 4;

export function isValidRating(value: number) {
  return Number.isInteger(value) && value >= RATING_MIN && value <= RATING_MAX;
}

export function averageRating(ratings: Array<number | null | undefined>) {
  const values = ratings.filter((r): r is number => typeof r === "number");
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

async function setStatus(reviewId: string, status: ReviewStatus, actor: { userId?: string | null; label: string }, extra: Record<string, unknown> = {}) {
  const before = await prisma.review.findUniqueOrThrow({ where: { id: reviewId }, select: { status: true } });
  await prisma.review.update({ where: { id: reviewId }, data: { status, ...extra } });
  await recordAudit({
    reviewId,
    actorUserId: actor.userId,
    actorLabel: actor.label,
    action: "review.status",
    field: "status",
    oldValue: before.status,
    newValue: status
  });
}

/** Called after either side submits. Moves to PENDING_OFFICE when both are in. */
export async function reconcileSides(reviewId: string) {
  const review = await prisma.review.findUniqueOrThrow({
    where: { id: reviewId },
    select: { status: true, supervisorStatus: true, employeeStatus: true }
  });
  if (
    (review.status === "OPEN" || review.status === "SENT_BACK") &&
    review.supervisorStatus === "SUBMITTED" &&
    review.employeeStatus === "SUBMITTED"
  ) {
    await setStatus(reviewId, "PENDING_OFFICE", { label: "system" });
  }
}

export async function submitSupervisorSide(reviewId: string, userId: string) {
  await prisma.review.update({
    where: { id: reviewId },
    data: { supervisorStatus: "SUBMITTED", supervisorSubmittedAt: new Date() }
  });
  await recordAudit({ reviewId, actorUserId: userId, actorLabel: "supervisor", action: "supervisor.submitted" });
  await reconcileSides(reviewId);
}

export async function submitEmployeeSide(reviewId: string) {
  await prisma.review.update({
    where: { id: reviewId },
    data: { employeeStatus: "SUBMITTED", employeeSubmittedAt: new Date() }
  });
  await recordAudit({ reviewId, actorLabel: "worker", action: "employee.submitted" });
  await reconcileSides(reviewId);
}

export async function approveReview(reviewId: string, userId: string) {
  await setStatus(reviewId, "APPROVED", { userId, label: "office" }, { approvedAt: new Date(), approvedById: userId });
}

export async function sendBackReview(reviewId: string, userId: string, reason: string) {
  await prisma.review.update({
    where: { id: reviewId },
    data: { supervisorStatus: "IN_PROGRESS", supervisorSubmittedAt: null }
  });
  await setStatus(reviewId, "SENT_BACK", { userId, label: "office" }, { sentBackReason: reason, sentBackAt: new Date() });
}

export async function markDiscussed(reviewId: string, userId: string) {
  await setStatus(reviewId, "DISCUSSED", { userId, label: "supervisor" }, { discussedAt: new Date() });
}

export async function markSignLinkSent(reviewId: string, userId?: string | null) {
  await setStatus(reviewId, "SIGN_LINK_SENT", { userId, label: userId ? "staff" : "system" });
}

export async function markSigned(reviewId: string) {
  await setStatus(reviewId, "SIGNED", { label: "worker" }, { signedAt: new Date() });
}

export async function markDeclined(reviewId: string) {
  await setStatus(reviewId, "DECLINED", { label: "worker" }, { declinedAt: new Date() });
}

export async function closeReview(reviewId: string, userId: string) {
  await setStatus(reviewId, "CLOSED", { userId, label: "office" }, { closedAt: new Date() });
}

/** Human labels for the office table and the foreman list. */
export function describeStatus(review: { status: ReviewStatus; supervisorStatus: string; employeeStatus: string }) {
  switch (review.status) {
    case "OPEN":
    case "SENT_BACK": {
      if (review.supervisorStatus !== "SUBMITTED" && review.employeeStatus !== "SUBMITTED") return "Both sides open";
      if (review.supervisorStatus !== "SUBMITTED") return review.status === "SENT_BACK" ? "Sent back to supervisor" : "Waiting on supervisor";
      return "Waiting on worker";
    }
    case "PENDING_OFFICE":
      return "Ready to approve";
    case "APPROVED":
      return "Approved · meet and confirm";
    case "DISCUSSED":
      return "Discussed · sign link queued";
    case "SIGN_LINK_SENT":
      return "Waiting on signature";
    case "SIGNED":
      return "Signed";
    case "DECLINED":
      return "Declined to sign";
    case "CLOSED":
      return "Closed";
  }
}
