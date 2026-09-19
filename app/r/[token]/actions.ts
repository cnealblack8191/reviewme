"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { checkIdentity, linkCookieName, linkCookieValue, markLinkUsed } from "@/lib/links";
import { isValidRating, markDeclined, markSigned, submitEmployeeSide } from "@/lib/reviews";
import { loadWorkerLink } from "@/lib/worker-link";
import { recordAudit } from "@/lib/audit";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function verifyIdentityAction(formData: FormData) {
  const token = field(formData, "token");
  const lang = field(formData, "lang") || "EN";
  const { state, link } = await loadWorkerLink(token, lang);
  if (state !== "ok" || !link) redirect(`/r/${token}?lang=${lang}`);

  const result = await checkIdentity(link.id, field(formData, "digits"));
  if (!result.ok) redirect(`/r/${token}?lang=${lang}${result.locked ? "" : "&error=1"}`);

  const store = await cookies();
  store.set(linkCookieName(link.id), linkCookieValue(link.id), {
    httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", path: `/r/${token}`, maxAge: 60 * 60 * 4
  });
  redirect(`/r/${token}/${link.kind === "SIGN" ? "sign" : "self"}?lang=${lang}`);
}

async function requireVerified(token: string, lang: string, kind: "SELF_EVAL" | "SIGN") {
  const loaded = await loadWorkerLink(token, lang);
  if (loaded.state !== "ok" || !loaded.link || !loaded.verified || loaded.link.kind !== kind) {
    redirect(`/r/${token}?lang=${lang}`);
  }
  return loaded.link;
}

async function persistSelfAnswers(formData: FormData, link: Awaited<ReturnType<typeof requireVerified>>) {
  const review = link.review;
  for (const question of review.template.questions) {
    const answer = field(formData, `q:${question.id}`);
    if (!answer) continue;
    await prisma.reviewQuestionAnswer.upsert({
      where: { reviewId_questionId: { reviewId: review.id, questionId: question.id } },
      update: { answer },
      create: { reviewId: review.id, questionId: question.id, answer }
    });
  }
  for (const criterion of review.template.criteria) {
    const raw = formData.get(`rating:${criterion.id}`);
    if (!raw) continue;
    const rating = Number(raw);
    if (!isValidRating(rating)) continue;
    await prisma.reviewAnswer.upsert({
      where: { reviewId_criterionId_side: { reviewId: review.id, criterionId: criterion.id, side: "EMPLOYEE" } },
      update: { rating },
      create: { reviewId: review.id, criterionId: criterion.id, side: "EMPLOYEE", rating }
    });
  }
  if (review.employeeStatus === "NOT_STARTED") {
    await prisma.review.update({ where: { id: review.id }, data: { employeeStatus: "IN_PROGRESS" } });
  }
}

export async function saveSelfAction(formData: FormData) {
  const token = field(formData, "token");
  const lang = field(formData, "lang") || "EN";
  const link = await requireVerified(token, lang, "SELF_EVAL");
  await persistSelfAnswers(formData, link);
  redirect(`/r/${token}/self?lang=${lang}&saved=1`);
}

export async function submitSelfAction(formData: FormData) {
  const token = field(formData, "token");
  const lang = field(formData, "lang") || "EN";
  const link = await requireVerified(token, lang, "SELF_EVAL");
  await persistSelfAnswers(formData, link);

  const rated = await prisma.reviewAnswer.count({ where: { reviewId: link.reviewId, side: "EMPLOYEE", rating: { not: null } } });
  if (rated < link.review.template.criteria.length) {
    redirect(`/r/${token}/self?lang=${lang}&incomplete=1`);
  }

  await submitEmployeeSide(link.reviewId);
  await markLinkUsed(link.id);
  redirect(`/r/${token}/done?lang=${lang}&kind=self`);
}

export async function signAction(formData: FormData) {
  const token = field(formData, "token");
  const lang = field(formData, "lang") || "EN";
  const link = await requireVerified(token, lang, "SIGN");
  const typedName = field(formData, "typedName");
  const imageData = field(formData, "signatureData");
  const comments = field(formData, "employeeComments");
  if (!typedName || !imageData.startsWith("data:image/")) redirect(`/r/${token}/sign?lang=${lang}&error=signature`);

  const requestHeaders = await headers();
  await prisma.signature.upsert({
    where: { reviewId: link.reviewId },
    update: { typedName, imageData, declined: false, declineComment: null, signedAt: new Date() },
    create: {
      reviewId: link.reviewId, typedName, imageData,
      ipAddress: requestHeaders.get("x-forwarded-for") ?? undefined,
      userAgent: requestHeaders.get("user-agent") ?? undefined
    }
  });
  await prisma.review.update({ where: { id: link.reviewId }, data: { employeeComments: comments || null } });
  await markSigned(link.reviewId);
  await markLinkUsed(link.id);
  redirect(`/r/${token}/done?lang=${lang}&kind=signed`);
}

export async function declineAction(formData: FormData) {
  const token = field(formData, "token");
  const lang = field(formData, "lang") || "EN";
  const link = await requireVerified(token, lang, "SIGN");
  const comment = field(formData, "employeeComments");
  if (!comment) redirect(`/r/${token}/sign?lang=${lang}&error=decline`);

  const requestHeaders = await headers();
  await prisma.signature.upsert({
    where: { reviewId: link.reviewId },
    update: { typedName: field(formData, "typedName") || "(declined)", imageData: null, declined: true, declineComment: comment, signedAt: new Date() },
    create: {
      reviewId: link.reviewId, typedName: field(formData, "typedName") || "(declined)", declined: true, declineComment: comment,
      ipAddress: requestHeaders.get("x-forwarded-for") ?? undefined,
      userAgent: requestHeaders.get("user-agent") ?? undefined
    }
  });
  await prisma.review.update({ where: { id: link.reviewId }, data: { employeeComments: comment } });
  await recordAudit({ reviewId: link.reviewId, actorLabel: "worker", action: "signature.declined" });
  await markDeclined(link.reviewId);
  await markLinkUsed(link.id);
  redirect(`/r/${token}/done?lang=${lang}&kind=declined`);
}
