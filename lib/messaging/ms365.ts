/**
 * Email through Microsoft 365 with the Graph API, application permission
 * Mail.Send, client credentials. Two credential styles:
 *   client secret        pasted on the Settings page or MICROSOFT_GRAPH_CLIENT_SECRET
 *   certificate + key    PEM pasted on the Settings page, or file paths in the environment
 * Setup: docs/MS365_EMAIL.md
 */
import { createHash, createSign, randomUUID, X509Certificate } from "node:crypto";
import fs from "node:fs/promises";
import { getGraphConfig, type GraphConfig } from "@/lib/messaging/config";

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

const tokenCache = new Map<string, { value: string; expiresAt: number }>();

function b64(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function certificateAssertion(config: GraphConfig) {
  const certificatePem = config.certificatePem ?? (config.certificatePath ? await fs.readFile(config.certificatePath, "utf8") : null);
  const privateKey = config.privateKeyPem ?? (config.privateKeyPath ? await fs.readFile(config.privateKeyPath, "utf8") : null);
  if (!certificatePem || !privateKey) throw new Error("Microsoft Graph certificate or private key is missing.");
  const certificate = new X509Certificate(certificatePem);
  const now = Math.floor(Date.now() / 1000);
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const header = b64({ alg: "RS256", typ: "JWT", x5t: createHash("sha1").update(certificate.raw).digest("base64url") });
  const payload = b64({ aud: tokenUrl, exp: now + 600, iss: config.clientId, jti: randomUUID(), nbf: now - 60, sub: config.clientId });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
}

async function accessToken(config: GraphConfig) {
  const cacheKey = `${config.tenantId}:${config.clientId}:${config.clientSecret ? "secret" : "cert"}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({ client_id: config.clientId, scope: GRAPH_SCOPE, grant_type: "client_credentials" });
  if (config.clientSecret) {
    params.set("client_secret", config.clientSecret);
  } else {
    params.set("client_assertion_type", ASSERTION_TYPE);
    params.set("client_assertion", await certificateAssertion(config));
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store"
  });
  const result = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(`Microsoft Graph authentication failed: ${result.error_description ?? response.statusText}`);
  }
  tokenCache.set(cacheKey, { value: result.access_token, expiresAt: Date.now() + Math.max(60, result.expires_in ?? 3600) * 1000 });
  return result.access_token;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const config = await getGraphConfig();
  if (!config) {
    return { status: "skipped:ms365-not-configured" as const, providerId: undefined };
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.sender)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(config)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: html ? "HTML" : "Text", content: html ?? text },
        toRecipients: [{ emailAddress: { address: to } }]
      },
      saveToSentItems: true
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Microsoft Graph sendMail failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return { status: "sent" as const, providerId: response.headers.get("request-id") ?? undefined };
}
