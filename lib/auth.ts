/**
 * Session handling. This is the single module that knows how a staff user is
 * authenticated. Today: email + password, HMAC-signed cookie, same shape as
 * the QC app. When the office desktop moves behind central.ecinc.us, replace
 * `authenticate()` and `createSession()` here and nothing else changes.
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { isOffice, isReviewer, type SessionUser } from "@/lib/types";

const SESSION_COOKIE = "reviewme-session";
const SESSION_MAX_AGE = 60 * 60 * 10;

interface SessionPayload {
  userId: string;
  issuedAt: number;
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured in production.");
  }
  return "local-dev-session-secret";
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function serialize(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function parse(value: string | undefined): SessionPayload | null {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  const expected = Buffer.from(sign(encoded), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_MAX_AGE
  };
}

export function buildSessionCookieValue(userId: string) {
  return serialize({ userId, issuedAt: Date.now() });
}

/** Email + password against the local user table. Swap point for central.ecinc.us. */
export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.isActive) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return toSessionUser(user);
}

function toSessionUser(user: { id: string; email: string; name: string; roles: Role[]; isActive: boolean }): SessionUser {
  return { id: user.id, email: user.email, name: user.name, roles: user.roles, isActive: user.isActive };
}

export async function createSession(user: SessionUser) {
  const store = await cookies();
  store.set(SESSION_COOKIE, buildSessionCookieValue(user.id), getSessionCookieOptions());
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = parse(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  return user?.isActive ? toSessionUser(user) : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOffice() {
  const user = await requireUser();
  if (!isOffice(user)) redirect("/me");
  return user;
}

/** Foreman, Project Manager, Senior Manager, or any office role. */
export async function requireReviewer() {
  const user = await requireUser();
  if (!isReviewer(user) && !isOffice(user)) redirect("/login");
  return user;
}

/** Where a user lands after login: office desktop for office-only roles, phone home for reviewers. */
export function homeFor(user: SessionUser) {
  return isOffice(user) && !isReviewer(user) ? "/office" : "/me";
}
