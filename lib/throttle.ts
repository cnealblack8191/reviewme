/**
 * Sign-in throttling for the staff login. Counts failures per email and per
 * client address inside a rolling window and locks the key for a cooling-off
 * period once the limit is hit. Worker links have their own lockout in
 * lib/links.ts. Successful sign-in clears the email counter.
 */
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 5;
const ADDRESS_LIMIT = 30;

function keys(email: string, address: string) {
  return { email: `email:${email.trim().toLowerCase()}`, address: `ip:${address}` };
}

export async function loginAllowed(email: string, address: string): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const k = keys(email, address);
  const rows = await prisma.loginThrottle.findMany({ where: { key: { in: [k.email, k.address] } } });
  const now = Date.now();
  const locked = rows.filter((r) => r.lockedUntil && r.lockedUntil.getTime() > now).map((r) => r.lockedUntil!.getTime());
  if (locked.length) return { allowed: false, retryAfterSeconds: Math.ceil((Math.max(...locked) - now) / 1000) };
  return { allowed: true };
}

async function bump(key: string, limit: number) {
  const now = new Date();
  const row = await prisma.loginThrottle.findUnique({ where: { key } });
  const inWindow = row && now.getTime() - row.firstFailureAt.getTime() < WINDOW_MS;
  const failures = inWindow ? row.failures + 1 : 1;
  const lockedUntil = failures >= limit ? new Date(now.getTime() + LOCK_MS) : null;
  await prisma.loginThrottle.upsert({
    where: { key },
    update: { failures, firstFailureAt: inWindow ? row.firstFailureAt : now, lockedUntil },
    create: { key, failures, firstFailureAt: now, lockedUntil }
  });
  return { failures, lockedUntil };
}

export async function recordLoginFailure(email: string, address: string) {
  const k = keys(email, address);
  const [byEmail, byAddress] = await Promise.all([bump(k.email, EMAIL_LIMIT), bump(k.address, ADDRESS_LIMIT)]);
  if (byEmail.lockedUntil || byAddress.lockedUntil) {
    await recordAudit({ actorLabel: "system", action: "login.locked", field: byEmail.lockedUntil ? k.email : k.address, newValue: `${byEmail.lockedUntil ? byEmail.failures : byAddress.failures} failures` });
  }
}

export async function clearLoginFailures(email: string) {
  await prisma.loginThrottle.deleteMany({ where: { key: keys(email, "").email } });
}

/**
 * The client address as Apache saw it. Apache appends the connecting address to
 * X-Forwarded-For, so the last entry is the real one; earlier entries come from
 * the client and can be forged.
 */
export function clientAddress(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || headers.get("x-real-ip") || "unknown";
}
