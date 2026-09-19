"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { deliver } from "@/lib/messaging";

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
  redirect(`/office/settings?test=${encodeURIComponent(result.status)}`);
}
