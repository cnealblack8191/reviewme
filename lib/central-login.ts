/**
 * Sign-in handoff from central.ecinc.us. Central authenticates the person and
 * redirects here with a short-lived JWT. We verify it, match the email to an
 * existing ReviewMe user with an office role, and open a normal session.
 * Contract: docs/CENTRAL_LOGIN.md
 */
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const CENTRAL_AUDIENCE = "reviewme";
const MAX_TOKEN_AGE_SECONDS = 10 * 60;

export interface CentralClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  email: string;
  name?: string;
  iat: number;
  exp: number;
  jti: string;
}

export type CentralVerifyResult = { ok: true; claims: CentralClaims } | { ok: false; reason: string };

export function centralLoginConfig() {
  const url = process.env.CENTRAL_LOGIN_URL?.trim();
  const secret = process.env.CENTRAL_LOGIN_SECRET?.trim();
  const publicKey = process.env.CENTRAL_LOGIN_PUBLIC_KEY?.trim();
  if (!url || (!secret && !publicKey)) return null;
  return {
    url,
    secret,
    publicKey: publicKey?.replace(/\\n/g, "\n"),
    issuer: process.env.CENTRAL_LOGIN_ISSUER?.trim() || "central.ecinc.us",
    required: process.env.CENTRAL_LOGIN_REQUIRED === "true"
  };
}

/** Where the login button sends the browser. Central must redirect back to return_to with ?token=. */
export function centralLoginStartUrl(returnTo: string) {
  const config = centralLoginConfig();
  if (!config) return null;
  const url = new URL(config.url);
  url.searchParams.set("app", CENTRAL_AUDIENCE);
  url.searchParams.set("return_to", returnTo);
  return url.toString();
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

export async function verifyCentralToken(token: string): Promise<CentralVerifyResult> {
  const config = centralLoginConfig();
  if (!config) return { ok: false, reason: "central login is not configured" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed token" };
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; typ?: string };
  let claims: Partial<CentralClaims>;
  try {
    header = decodeSegment(headerB64);
    claims = decodeSegment(payloadB64);
  } catch {
    return { ok: false, reason: "token is not valid JSON" };
  }

  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(signatureB64, "base64url");
  let valid = false;
  if (header.alg === "HS256" && config.secret) {
    const expected = crypto.createHmac("sha256", config.secret).update(signingInput).digest();
    valid = expected.length === signature.length && crypto.timingSafeEqual(expected, signature);
  } else if (header.alg === "RS256" && config.publicKey) {
    valid = crypto.createVerify("RSA-SHA256").update(signingInput).end().verify(config.publicKey, signature);
  } else {
    return { ok: false, reason: `unsupported algorithm ${header.alg ?? "(none)"}` };
  }
  if (!valid) return { ok: false, reason: "bad signature" };

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= now) return { ok: false, reason: "token expired" };
  if (typeof claims.iat !== "number" || claims.iat > now + 60 || claims.exp - claims.iat > MAX_TOKEN_AGE_SECONDS) {
    return { ok: false, reason: "token lifetime out of range" };
  }
  if (claims.iss !== config.issuer) return { ok: false, reason: "wrong issuer" };
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(CENTRAL_AUDIENCE)) return { ok: false, reason: "wrong audience" };
  if (!claims.jti || !claims.sub || !claims.email) return { ok: false, reason: "missing jti, sub or email" };

  // Replay protection: a jti works once.
  try {
    await prisma.consumedLoginToken.create({ data: { jti: claims.jti, expiresAt: new Date(claims.exp * 1000) } });
  } catch {
    return { ok: false, reason: "token already used" };
  }
  await prisma.consumedLoginToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined);

  return { ok: true, claims: claims as CentralClaims };
}
