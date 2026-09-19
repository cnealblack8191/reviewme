/** Twilio Programmable Messaging over plain fetch, no SDK. */
export async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return { status: "skipped:twilio-not-configured" as const, providerId: undefined };
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ To: to, From: from, Body: body })
  });

  const payload = (await response.json()) as { sid?: string; message?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? `Twilio responded ${response.status}`);
  }
  return { status: "sent" as const, providerId: payload.sid };
}
