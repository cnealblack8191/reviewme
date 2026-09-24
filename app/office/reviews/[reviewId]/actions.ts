"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveReview, closeReview, markSignLinkSent, sendBackReview } from "@/lib/reviews";
import { decryptToken, issueLink, linkUrl } from "@/lib/links";
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
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { status: true } });
  if (review?.status !== "PENDING_OFFICE") return;
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

export async function closeReviewAction(formData: FormData) {
  const user = await requireOffice();
  const reviewId = reviewIdFrom(formData);
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { status: true } });
  if (!review || !["SIGNED", "DECLINED"].includes(review.status)) return;
  await closeReview(reviewId, user.id);
  revalidatePath(`/office/reviews/${reviewId}`);
  revalidatePath("/office");
}

const SIGN_LINK_STATUSES = ["APPROVED", "DISCUSSED", "SIGN_LINK_SENT"] as const;

/** Issue (or reissue) the sign link by text or email. Allowed once the office has approved. */
export async function sendSignLinkAction(formData: FormData) {
  const user = await requireOffice();
  const reviewId = reviewIdFrom(formData);
  const review = await prisma.review.findUnique({ where: { id: reviewId }, include: { employee: true } });
  if (!review || !(SIGN_LINK_STATUSES as readonly string[]).includes(review.status)) return;

  const employee = review.employee;
  const channel = employee.phone ? "SMS" : employee.email ? "EMAIL" : null;
  if (!channel) {
    revalidatePath(`/office/reviews/${reviewId}`);
    return;
  }
  const to = channel === "SMS" ? employee.phone! : employee.email!;
  const { url } = await issueLink({ reviewId, kind: "SIGN", channel, sentTo: to, createdById: user.id });
  const body =
    review.language === "ES"
      ? `ECI ReviewMe: su evaluación está lista para leer y firmar. Enlace privado, válido por tiempo limitado: ${url} Responda STOP para cancelar.`
      : `ECI ReviewMe: your review is ready to read and sign. Private link, valid for a limited time: ${url} Reply STOP to opt out.`;
  await deliver({ channel, to, body, subject: "Your ECI review is ready to sign", purpose: "sign-link", reviewId, employeeId: employee.id });
  if (review.status !== "SIGN_LINK_SENT") await markSignLinkSent(reviewId, user.id);
  revalidatePath(`/office/reviews/${reviewId}`);
  revalidatePath("/office");
}

/** Create a link the office sends by hand, for a worker with no phone or email on file. The URL is shown once. */
export async function createManualLinkAction(formData: FormData) {
  const user = await requireOffice();
  const reviewId = reviewIdFrom(formData);
  const kind = String(formData.get("kind")) === "SIGN" ? "SIGN" : "SELF_EVAL";
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { status: true, employeeStatus: true } });
  if (!review) return;
  if (kind === "SELF_EVAL" && review.employeeStatus === "SUBMITTED") return;
  if (kind === "SIGN" && !(SIGN_LINK_STATUSES as readonly string[]).includes(review.status)) return;

  const { link } = await issueLink({ reviewId, kind, channel: "MANUAL", createdById: user.id });
  if (kind === "SELF_EVAL" && review.employeeStatus === "NOT_STARTED") {
    await prisma.review.update({ where: { id: reviewId }, data: { employeeStatus: "IN_PROGRESS" } });
  }
  if (kind === "SIGN" && review.status !== "SIGN_LINK_SENT") await markSignLinkSent(reviewId, user.id);
  await prisma.messageLog.create({ data: { reviewId, channel: "MANUAL", to: "office", purpose: kind === "SIGN" ? "sign-link" : "self-eval-link", status: "handoff" } });
  revalidatePath(`/office/reviews/${reviewId}`);
  redirect(`/office/reviews/${reviewId}?reveal=${link.id}`);
}

/** Show the URL of an existing active link so the office can send it by hand. Audited. */
export async function revealLinkAction(formData: FormData) {
  const user = await requireOffice();
  const reviewId = reviewIdFrom(formData);
  const linkId = String(formData.get("linkId") ?? "");
  const link = await prisma.reviewLink.findUnique({ where: { id: linkId } });
  if (!link || link.reviewId !== reviewId || link.usedAt || link.voidedAt || link.lockedAt || link.expiresAt < new Date()) return;
  await recordAudit({ reviewId, actorUserId: user.id, actorLabel: "office", action: "link.revealed", newValue: `${link.kind} · ${link.channel}` });
  redirect(`/office/reviews/${reviewId}?reveal=${linkId}`);
}

/** Server-side helper for the page: the plain URL for a link the office asked to see. */
export async function revealedUrl(reviewId: string, linkId: string | undefined) {
  if (!linkId) return null;
  const link = await prisma.reviewLink.findUnique({ where: { id: linkId } });
  if (!link || link.reviewId !== reviewId || !link.tokenCiphertext || link.usedAt || link.voidedAt || link.lockedAt || link.expiresAt < new Date()) return null;
  const token = decryptToken(link.tokenCiphertext);
  return token ? { url: linkUrl(token), kind: link.kind, expiresAt: link.expiresAt } : null;
}
