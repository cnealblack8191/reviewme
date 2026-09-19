"use server";

import { revalidatePath } from "next/cache";
import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveReview, sendBackReview } from "@/lib/reviews";
import { issueLink } from "@/lib/links";
import { deliver } from "@/lib/messaging";
import { recordAudit } from "@/lib/audit";

function reviewIdFrom(formData: FormData) {
  return String(formData.get("reviewId") ?? "");
}

export async function approveAction(formData: FormData) {
  const user = await requireOffice();
  const reviewId = reviewIdFrom(formData);
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { status: true } });
  if (review?.status !== "PENDING_OFFICE") return;
  await approveReview(reviewId, user.id);
  revalidatePath(`/office/reviews/${reviewId}`);
  revalidatePath("/office");
}

export async function sendBackAction(formData: FormData) {
  const user = await requireOffice();
  const reviewId = reviewIdFrom(formData);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return;
  await sendBackReview(reviewId, user.id, reason);
  revalidatePath(`/office/reviews/${reviewId}`);
  revalidatePath("/office");
}

/** Issue (or reissue) the worker's one-time self-evaluation link. Voids any earlier one. */
export async function sendSelfLinkAction(formData: FormData) {
  const user = await requireOffice();
  const reviewId = reviewIdFrom(formData);
  const review = await prisma.review.findUnique({ where: { id: reviewId }, include: { employee: true } });
  if (!review || review.employeeStatus === "SUBMITTED") return;

  const employee = review.employee;
  const channel = employee.phone ? "SMS" : employee.email ? "EMAIL" : null;
  if (!channel) return;
  const to = channel === "SMS" ? employee.phone! : employee.email!;

  const { url } = await issueLink({ reviewId, kind: "SELF_EVAL", channel, sentTo: to, createdById: user.id });
  const body =
    review.language === "ES"
      ? `ECI: complete su autoevaluación. Enlace privado, solo para usted, válido por tiempo limitado: ${url}`
      : `ECI: please complete your self-evaluation. Private link, just for you, valid for a limited time: ${url}`;
  await deliver({ channel, to, body, subject: "Your ECI self-evaluation", purpose: "self-eval-link", reviewId, employeeId: employee.id });

  if (review.employeeStatus === "NOT_STARTED") {
    await prisma.review.update({ where: { id: reviewId }, data: { employeeStatus: "IN_PROGRESS" } });
  }
  revalidatePath(`/office/reviews/${reviewId}`);
  revalidatePath("/office");
}

export async function addOfficeNoteAction(formData: FormData) {
  const user = await requireOffice();
  const reviewId = reviewIdFrom(formData);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await prisma.officeNote.create({ data: { reviewId, authorId: user.id, body } });
  revalidatePath(`/office/reviews/${reviewId}`);
}

function decimal(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function date(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? new Date(text) : null;
}

export async function savePayBlockAction(formData: FormData) {
  const user = await requireOffice();
  const reviewId = reviewIdFrom(formData);
  const data = {
    currentPayRate: decimal(formData.get("currentPayRate")),
    lastRaiseDate: date(formData.get("lastRaiseDate")),
    lastRaiseAmount: decimal(formData.get("lastRaiseAmount")),
    raiseAmount: decimal(formData.get("raiseAmount")),
    newPayRate: decimal(formData.get("newPayRate")),
    dateEffective: date(formData.get("dateEffective")),
    nextReviewDate: date(formData.get("nextReviewDate")),
    updatedById: user.id
  };
  await prisma.payBlock.upsert({ where: { reviewId }, update: data, create: { reviewId, ...data } });
  await recordAudit({ reviewId, actorUserId: user.id, actorLabel: "office", action: "payblock.saved" });
  revalidatePath(`/office/reviews/${reviewId}`);
}
