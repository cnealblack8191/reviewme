import crypto from "node:crypto";

const KEY_LENGTH = 64;
const PREFIX = "scrypt";

export function hashSecret(value: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(value.normalize("NFKC"), salt, KEY_LENGTH);
  return `${PREFIX}:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

export function verifySecret(value: string, encoded: string) {
  const [prefix, saltValue, hashValue] = encoded.split(":");
  if (prefix !== PREFIX || !saltValue || !hashValue) return false;
  try {
    const expected = Buffer.from(hashValue, "base64url");
    const actual = crypto.scryptSync(value.normalize("NFKC"), Buffer.from(saltValue, "base64url"), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export const hashPassword = hashSecret;
export const verifyPassword = verifySecret;

export function isStrongEnoughPassword(password: string) {
  return password.length >= 12;
}
