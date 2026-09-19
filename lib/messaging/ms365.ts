/**
 * Email through Microsoft 365 with the Graph API, application permission
 * Mail.Send, authenticated by certificate (client credentials). Same approach
 * the ECI QC app uses. No SMTP, no extra dependency.
 *
 * Setup: docs/MS365_EMAIL.md
 */
import { createHash, createSign, randomUUID, X509Certificate } from "node:crypto";
import fs from "node:fs/promises";

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

let cachedToken: { value: string; expiresAt: number } | null = null;

type GraphConfig = {
  tenantId: string;
  clientId: string;
  sender: string;
  certificatePath: string;
  privateKeyPath: string;
};

function getConfig(): GraphConfig | null {
  const tenantId = process.env.MICROSOFT_GRAPH_TENANT_ID;
  const clientId = process.env.MICROSOFT_GRAPH_CLIENT_ID;
  const sender = process.env.MICROSOFT_GRAPH_SENDER;
  const certificatePath = process.env.MICROSOFT_GRAPH_CERTIFICATE_PATH;
  const privateKeyPath = process.env.MICROSOFT_GRAPH_PRIVATE_KEY_PATH;
  if (!tenantId || !clientId || !sender || !certificatePath || !privateKeyPath) return null;
  return { tenantId, clientId, sender, certificatePath, privateKeyPath };
}

function b64(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function clientAssertion(config: GraphConfig) {
  const [certificatePem, privateKey] = await Promise.all([
    fs.readFile(config.certificatePath, "utf8"),
    fs.readFile(config.privateKeyPath, "utf8")
  ]);
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
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      scope: GRAPH_SCOPE,
      grant_type: "client_credentials",
      client_assertion_type: ASSERTION_TYPE,
      client_assertion: await clientAssertion(config)
    }),
    cache: "no-store"
  });
  const result = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(`Microsoft Graph authentication failed: ${result.error_description ?? response.statusText}`);
  }
  cachedToken = { value: result.access_token, expiresAt: Date.now() + Math.max(60, result.expires_in ?? 3600) * 1000 };
  return result.access_token;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const config = getConfig();
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
  // Graph returns 202 with no body; the request id is the closest thing to a provider id.
  return { status: "sent" as const, providerId: response.headers.get("request-id") ?? undefined };
}
