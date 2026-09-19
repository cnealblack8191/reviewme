/**
 * One-time worker links. The raw token lives only in the text or email; the
 * database keeps a sha256 hash. A link opens after the identity check (last 4
 * of the phone, or SSN by company setting), locks after too many misses, dies
 * on submit, and is voided when a newer link of the same kind is issued.
 */
import crypto from "node:crypto";
import type { LinkKind, MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { verifySecret } from "@/lib/password";
import { recordAudit } from "@/lib/audit";

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ---- Token at rest: AES-256-GCM under a key derived from SESSION_SECRET ----
// The hash finds a link; the ciphertext lets a reminder resend the same URL.

function tokenKey() {
  const secret = process.env.SESSION_SECRET ?? "local-dev-session-secret";
  return crypto.createHash("sha256").update(`${secret}:review-links`).digest();
}

export function encryptToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenKey(), iv);
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, body, cipher.getAuthTag()].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(ciphertext: string): string | null {
  try {
    const [iv, body, tag] = ciphertext.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", tokenKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function linkUrl(token: string) {
  const base = (process.env.APP_BASE_URL ?? "http://127.0.0.1:3010").replace(/\/$/, "");
  return `${base}/r/${token}`;
}

export async function issueLink(input: {
  reviewId: string;
  kind: LinkKind;
  channel: MessageChannel;
  sentTo?: string;
  createdById?: string;
}) {
  const settings = await getSettings();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + settings.linkTtlDays * 24 * 60 * 60 * 1000);

  await prisma.reviewLink.updateMany({
    where: { reviewId: input.reviewId, kind: input.kind, usedAt: null, voidedAt: null },
    data: { voidedAt: new Date() }
  });

  const link = await prisma.reviewLink.create({
    data: {
      reviewId: input.reviewId,
      kind: input.kind,
      channel: input.channel,
      sentTo: input.sentTo,
      tokenHash: hashToken(token),
      tokenCiphertext: encryptToken(token),
      expiresAt,
      createdById: input.createdById
    }
  });

  await recordAudit({
    reviewId: input.reviewId,
    actorUserId: input.createdById,
    actorLabel: input.createdById ? "staff" : "system",
    action: `link.issued.${input.kind.toLowerCase()}`,
    newValue: `${input.channel} → ${input.sentTo ?? "handoff"}`
  });

  return { link, token, url: linkUrl(token) };
}

export type LinkState = "ok" | "not_found" | "expired" | "used" | "voided" | "locked";

export async function resolveLink(token: string) {
  const link = await prisma.reviewLink.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      review: {
        include: {
          employee: true,
          template: { include: { criteria: { orderBy: { sortOrder: "asc" } }, questions: { orderBy: { sortOrder: "asc" } } } },
          answers: true,
          questionAnswers: true,
          supervisor: { select: { name: true } }
        }
      }
    }
  });

  if (!link) return { state: "not_found" as LinkState, link: null };
  let state: LinkState = "ok";
  if (link.lockedAt) state = "locked";
  else if (link.usedAt) state = "used";
  else if (link.voidedAt) state = "voided";
  else if (link.expiresAt < new Date()) state = "expired";

  if (state === "ok" && !link.openedAt) {
    await prisma.reviewLink.update({ where: { id: link.id }, data: { openedAt: new Date() } });
  }

  return { state, link };
}

/** Compare the four digits the worker typed against the employee record. Locks after linkMaxAttempts misses. */
export async function checkIdentity(linkId: string, digits: string) {
  const settings = await getSettings();
  const link = await prisma.reviewLink.findUnique({
    where: { id: linkId },
    include: { review: { include: { employee: true } } }
  });
  if (!link || link.lockedAt || link.usedAt || link.voidedAt) return { ok: false, locked: Boolean(link?.lockedAt) };

  const cleaned = digits.replace(/\D/g, "");
  const employee = link.review.employee;
  let matches = false;
  if (settings.identityCheck === "PHONE_LAST4") {
    matches = Boolean(employee.phoneLast4) && cleaned === employee.phoneLast4;
  } else {
    matches = Boolean(employee.ssnLast4Hash) && verifySecret(cleaned, employee.ssnLast4Hash!);
  }

  if (matches) {
    await prisma.reviewLink.update({ where: { id: linkId }, data: { verifiedAt: new Date(), attempts: 0 } });
    return { ok: true, locked: false };
  }

  const attempts = link.attempts + 1;
  const locked = attempts >= settings.linkMaxAttempts;
  await prisma.reviewLink.update({
    where: { id: linkId },
    data: { attempts, lockedAt: locked ? new Date() : undefined }
  });
  if (locked) {
    await recordAudit({ reviewId: link.reviewId, actorLabel: "worker", action: "link.locked", newValue: `${attempts} failed identity checks` });
  }
  return { ok: false, locked };
}

export async function markLinkUsed(linkId: string) {
  await prisma.reviewLink.update({ where: { id: linkId }, data: { usedAt: new Date() } });
}

// ---- Verified-link cookie, so the worker is not asked for digits on every page ----

const LINK_COOKIE_PREFIX = "eci-review-link-";

function signLink(linkId: string) {
  const secret = process.env.SESSION_SECRET ?? "local-dev-session-secret";
  return crypto.createHmac("sha256", secret).update(`link:${linkId}`).digest("hex");
}

export function linkCookieName(linkId: string) {
  return `${LINK_COOKIE_PREFIX}${linkId}`;
}

export function linkCookieValue(linkId: string) {
  return signLink(linkId);
}

export function isLinkCookieValid(linkId: string, value: string | undefined) {
  if (!value) return false;
  const expected = Buffer.from(signLink(linkId), "hex");
  const received = Buffer.from(value, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
