/**
 * Server configuration that must be present in production. Development keeps
 * working with local fallbacks; production fails loudly instead of signing
 * sessions, links, or stored credentials with a key that is in this repo.
 */
const DEV_SESSION_SECRET = "local-dev-session-secret";
const DEV_BASE_URL = "http://127.0.0.1:3010";

const isProduction = () => process.env.NODE_ENV === "production";

export function sessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (isProduction()) throw new Error("SESSION_SECRET must be configured in production.");
  return DEV_SESSION_SECRET;
}

/** Key source for credentials saved on the Settings page. */
export function encryptionSecret() {
  return process.env.APP_ENCRYPTION_KEY?.trim() || sessionSecret();
}

/** Public origin, no trailing slash. Worker links and emails are built from it. */
export function appBaseUrl() {
  const base = process.env.APP_BASE_URL?.trim();
  if (base) return base.replace(/\/$/, "");
  if (isProduction()) throw new Error("APP_BASE_URL must be configured in production.");
  return DEV_BASE_URL;
}

/** Called once at server start (instrumentation.ts) so a bad .env stops PM2 from serving. */
export function assertProductionEnv() {
  if (!isProduction()) return;
  const problems: string[] = [];
  if (!process.env.DATABASE_URL?.trim()) problems.push("DATABASE_URL is not set.");
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  if (!secret) problems.push("SESSION_SECRET is not set.");
  else if (secret.length < 32 || secret === "replace-with-a-long-random-string") problems.push("SESSION_SECRET must be a random string of at least 32 characters.");
  const base = process.env.APP_BASE_URL?.trim() ?? "";
  if (!base) problems.push("APP_BASE_URL is not set.");
  else if (!base.startsWith("https://")) problems.push("APP_BASE_URL must be https:// in production.");
  if (process.env.COOKIE_SECURE !== "true") problems.push('COOKIE_SECURE must be "true" in production.');
  if (problems.length) throw new Error(`ReviewMe configuration:\n  ${problems.join("\n  ")}`);
}
