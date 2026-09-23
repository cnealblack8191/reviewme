/**
 * Resolves messaging credentials: values saved on the admin Settings page win,
 * environment variables fill anything left blank. Each resolver reports where
 * the values came from so the Settings page can show it.
 */
import { getSettings } from "@/lib/settings";
import { decryptSecret } from "@/lib/secrets";

export type ConfigSource = "settings" | "environment" | "none";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  source: ConfigSource;
}

export interface GraphConfig {
  tenantId: string;
  clientId: string;
  sender: string;
  /** One of the two credential styles is present. */
  clientSecret?: string;
  certificatePem?: string;
  privateKeyPem?: string;
  certificatePath?: string;
  privateKeyPath?: string;
  source: ConfigSource;
}

export async function getTwilioConfig(): Promise<TwilioConfig | null> {
  const s = await getSettings();
  const fromSettings = {
    accountSid: s.twilioAccountSid?.trim() ?? "",
    authToken: decryptSecret(s.twilioAuthTokenEnc) ?? "",
    fromNumber: s.twilioFromNumber?.trim() ?? ""
  };
  if (fromSettings.accountSid && fromSettings.authToken && fromSettings.fromNumber) return { ...fromSettings, source: "settings" };

  const fromEnv = {
    accountSid: process.env.TWILIO_ACCOUNT_SID?.trim() ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? "",
    fromNumber: process.env.TWILIO_FROM_NUMBER?.trim() ?? ""
  };
  if (fromEnv.accountSid && fromEnv.authToken && fromEnv.fromNumber) return { ...fromEnv, source: "environment" };
  return null;
}

export async function getGraphConfig(): Promise<GraphConfig | null> {
  const s = await getSettings();
  const tenantId = s.graphTenantId?.trim() ?? "";
  const clientId = s.graphClientId?.trim() ?? "";
  const sender = s.graphSender?.trim() ?? "";
  const clientSecret = decryptSecret(s.graphClientSecretEnc) ?? undefined;
  const certificatePem = decryptSecret(s.graphCertificatePemEnc) ?? undefined;
  const privateKeyPem = decryptSecret(s.graphPrivateKeyPemEnc) ?? undefined;
  if (tenantId && clientId && sender && (clientSecret || (certificatePem && privateKeyPem))) {
    return { tenantId, clientId, sender, clientSecret, certificatePem, privateKeyPem, source: "settings" };
  }

  const env = {
    tenantId: process.env.MICROSOFT_GRAPH_TENANT_ID?.trim() ?? "",
    clientId: process.env.MICROSOFT_GRAPH_CLIENT_ID?.trim() ?? "",
    sender: process.env.MICROSOFT_GRAPH_SENDER?.trim() ?? "",
    clientSecret: process.env.MICROSOFT_GRAPH_CLIENT_SECRET?.trim() || undefined,
    certificatePath: process.env.MICROSOFT_GRAPH_CERTIFICATE_PATH?.trim() || undefined,
    privateKeyPath: process.env.MICROSOFT_GRAPH_PRIVATE_KEY_PATH?.trim() || undefined
  };
  if (env.tenantId && env.clientId && env.sender && (env.clientSecret || (env.certificatePath && env.privateKeyPath))) {
    return { ...env, source: "environment" };
  }
  return null;
}
