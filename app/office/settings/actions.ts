"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { deliver } from "@/lib/messaging";
import { encryptSecret } from "@/lib/secrets";
import { sendSms } from "@/lib/messaging/twilio";

function int(formData: FormData, key: string, fallback: number, min: number, max: number) {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export async function saveSettingsAction(formData: FormData) {
  const user = await requireAdmin();
  const before = await prisma.companySettings.findUniqueOrThrow({ where: { id: "eci" } });
  const data = {
    name: String(formData.get("name") ?? "").trim() || before.name,
    shortName: String(formData.get("shortName") ?? "").trim() || before.shortName,
    identityCheck: formData.get("identityCheck") === "SSN_LAST4" ? ("SSN_LAST4" as const) : ("PHONE_LAST4" as const),
    linkTtlDays: int(formData, "linkTtlDays", before.linkTtlDays, 1, 60),
    linkMaxAttempts: int(formData, "linkMaxAttempts", before.linkMaxAttempts, 1, 10),
    remindersEnabled: formData.get("remindersEnabled") === "on",
    reminderEmployeeDays: int(formData, "reminderEmployeeDays", before.reminderEmployeeDays, 1, 30),
    reminderSupervisorDays: int(formData, "reminderSupervisorDays", before.reminderSupervisorDays, 1, 60),
    reminderQuietStartHour: int(formData, "reminderQuietStartHour", before.reminderQuietStartHour, 0, 23),
    reminderQuietEndHour: int(formData, "reminderQuietEndHour", before.reminderQuietEndHour, 1, 24),
    timezone: String(formData.get("timezone") ?? "").trim() || before.timezone,
    smsEnabled: formData.get("smsEnabled") === "on",
    emailEnabled: formData.get("emailEnabled") === "on"
  };
  await prisma.companySettings.update({ where: { id: "eci" }, data });

  const changed = (Object.keys(data) as Array<keyof typeof data>).filter((k) => String(before[k]) !== String(data[k]));
  for (const key of changed) {
    await recordAudit({ actorUserId: user.id, actorLabel: "admin", action: "settings.changed", field: key, oldValue: String(before[key]), newValue: String(data[key]) });
  }
  redirect("/office/settings?saved=1");
}

export async function sendTestEmailAction() {
  const user = await requireAdmin();
  const result = await deliver({
    channel: "EMAIL",
    to: user.email,
    subject: "ReviewMe test email",
    body: `This is a test from ReviewMe sent by ${user.name} at ${new Date().toLocaleString("en-US")}. If you can read this, Microsoft 365 email is working.`,
    purpose: "test-email"
  });
  redirect(`/office/settings?test=${encodeURIComponent(result.error ? `failed: ${result.error.slice(0, 120)}` : result.status)}`);
}


function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveTwilioAction(formData: FormData) {
  const user = await requireAdmin();
  const accountSid = text(formData, "twilioAccountSid");
  const authToken = text(formData, "twilioAuthToken");
  const fromNumber = text(formData, "twilioFromNumber");
  if (accountSid && !/^AC[0-9a-fA-F]{32}$/.test(accountSid)) redirect("/office/settings?error=Twilio+Account+SID+should+start+with+AC+and+be+34+characters");
  if (fromNumber && !/^\+[1-9]\d{7,14}$/.test(fromNumber)) redirect("/office/settings?error=From+number+must+be+E.164,+like+%2B15551234567");
  await prisma.companySettings.update({
    where: { id: "eci" },
    data: {
      twilioAccountSid: accountSid || null,
      twilioFromNumber: fromNumber || null,
      ...(authToken ? { twilioAuthTokenEnc: encryptSecret(authToken) } : {})
    }
  });
  await recordAudit({ actorUserId: user.id, actorLabel: "admin", action: "settings.twilio", newValue: `${accountSid ? "SID set" : "SID cleared"}${authToken ? ", token updated" : ""}${fromNumber ? `, from ${fromNumber}` : ""}` });
  redirect("/office/settings?saved=1");
}

export async function clearTwilioAction() {
  const user = await requireAdmin();
  await prisma.companySettings.update({ where: { id: "eci" }, data: { twilioAccountSid: null, twilioAuthTokenEnc: null, twilioFromNumber: null, smsEnabled: false } });
  await recordAudit({ actorUserId: user.id, actorLabel: "admin", action: "settings.twilio", newValue: "cleared" });
  redirect("/office/settings?saved=1");
}

export async function saveGraphAction(formData: FormData) {
  const user = await requireAdmin();
  const mode = text(formData, "graphMode") === "certificate" ? "certificate" : "secret";
  const clientSecret = text(formData, "graphClientSecret");
  const certificatePem = text(formData, "graphCertificatePem");
  const privateKeyPem = text(formData, "graphPrivateKeyPem");
  if (certificatePem && !certificatePem.includes("BEGIN CERTIFICATE")) redirect("/office/settings?error=Certificate+must+be+PEM+text+starting+with+BEGIN+CERTIFICATE");
  if (privateKeyPem && !privateKeyPem.includes("PRIVATE KEY")) redirect("/office/settings?error=Private+key+must+be+PEM+text");
  await prisma.companySettings.update({
    where: { id: "eci" },
    data: {
      graphSender: text(formData, "graphSender").toLowerCase() || null,
      graphTenantId: text(formData, "graphTenantId") || null,
      graphClientId: text(formData, "graphClientId") || null,
      ...(mode === "secret"
        ? { ...(clientSecret ? { graphClientSecretEnc: encryptSecret(clientSecret) } : {}), graphCertificatePemEnc: null, graphPrivateKeyPemEnc: null }
        : {
            graphClientSecretEnc: null,
            ...(certificatePem ? { graphCertificatePemEnc: encryptSecret(certificatePem) } : {}),
            ...(privateKeyPem ? { graphPrivateKeyPemEnc: encryptSecret(privateKeyPem) } : {})
          })
    }
  });
  await recordAudit({ actorUserId: user.id, actorLabel: "admin", action: "settings.ms365", newValue: `${mode}${clientSecret || certificatePem || privateKeyPem ? ", credential updated" : ""}` });
  redirect("/office/settings?saved=1");
}

export async function clearGraphAction() {
  const user = await requireAdmin();
  await prisma.companySettings.update({
    where: { id: "eci" },
    data: { graphSender: null, graphTenantId: null, graphClientId: null, graphClientSecretEnc: null, graphCertificatePemEnc: null, graphPrivateKeyPemEnc: null }
  });
  await recordAudit({ actorUserId: user.id, actorLabel: "admin", action: "settings.ms365", newValue: "cleared" });
  redirect("/office/settings?saved=1");
}

/** Bypasses the Send texts switch on purpose: this is how you prove the credentials before turning texting on. */
export async function sendTestSmsAction(formData: FormData) {
  const user = await requireAdmin();
  const to = text(formData, "to");
  if (!/^\+[1-9]\d{7,14}$/.test(to)) redirect("/office/settings?error=Test+number+must+be+E.164,+like+%2B15551234567");
  let status = "failed";
  let providerId: string | undefined;
  let error: string | undefined;
  try {
    const result = await sendSms(to, `ReviewMe test text sent by ${user.name}. If you can read this, Twilio is working.`);
    status = result.status;
    providerId = result.providerId;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  await prisma.messageLog.create({ data: { channel: "SMS", to, purpose: "test-sms", status, providerId, error } });
  redirect(`/office/settings?testsms=${encodeURIComponent(error ? `failed: ${error.slice(0, 120)}` : status)}`);
}
