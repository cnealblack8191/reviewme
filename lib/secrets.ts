/**
 * At-rest encryption for credentials stored in the database (Twilio token,
 * Microsoft client secret or private key). AES-256-GCM under a key derived
 * from APP_ENCRYPTION_KEY, falling back to SESSION_SECRET. Rotating the key
 * means re-entering the secrets on the Settings page.
 */
import crypto from "node:crypto";

function key() {
  const source = process.env.APP_ENCRYPTION_KEY ?? process.env.SESSION_SECRET ?? "local-dev-session-secret";
  return crypto.createHash("sha256").update(`${source}:settings-secrets`).digest();
}

export function encryptSecret(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), body.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

export function decryptSecret(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  try {
    const [version, iv, body, tag] = ciphertext.split(".");
    if (version !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** "••••1234" style hint for a stored secret, never the value. */
export function maskTail(value: string | null | undefined, keep = 4) {
  if (!value) return "";
  return value.length <= keep ? "••••" : `••••${value.slice(-keep)}`;
}
