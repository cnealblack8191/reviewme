/** Twilio Programmable Messaging over plain fetch, no SDK. Credentials from Settings or the environment. */
import { getTwilioConfig } from "@/lib/messaging/config";

export async function sendSms(to: string, body: string) {
  const config = await getTwilioConfig();
  if (!config) {
    return { status: "skipped:twilio-not-configured" as const, providerId: undefined };
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ To: to, From: config.fromNumber, Body: body })
  });

  const payload = (await response.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? `Twilio responded ${response.status}`);
  }
  return { status: "sent" as const, providerId: payload.sid };
}
