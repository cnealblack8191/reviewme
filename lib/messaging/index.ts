/**
 * Outbound messages to workers and staff. Both adapters log to MessageLog and
 * degrade to "logged, not sent" when the provider is not configured or the
 * company switch is off, so the app works before Twilio's 10DLC clears.
 */
import type { MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { sendSms } from "@/lib/messaging/twilio";
import { sendEmail } from "@/lib/messaging/ms365";

interface Outbound {
  channel: MessageChannel;
  to: string;
  subject?: string;
  body: string;
  purpose: string;
  reviewId?: string;
  employeeId?: string;
}

export async function deliver(message: Outbound) {
  const settings = await getSettings();
  let status = "skipped";
  let providerId: string | undefined;
  let error: string | undefined;

  try {
    if (message.channel === "SMS") {
      if (!settings.smsEnabled) {
        status = "skipped:sms-disabled";
      } else {
        const result = await sendSms(message.to, message.body);
        status = result.status;
        providerId = result.providerId;
      }
    } else if (message.channel === "EMAIL") {
      if (!settings.emailEnabled) {
        status = "skipped:email-disabled";
      } else {
        const result = await sendEmail(message.to, message.subject ?? "ReviewMe", message.body);
        status = result.status;
        providerId = result.providerId;
      }
    } else {
      status = "handoff";
    }
  } catch (caught) {
    status = "failed";
    error = caught instanceof Error ? caught.message : String(caught);
  }

  await prisma.messageLog.create({
    data: {
      reviewId: message.reviewId,
      employeeId: message.employeeId,
      channel: message.channel,
      to: message.to,
      purpose: message.purpose,
      providerId,
      status,
      error
    }
  });

  return { status, providerId, error };
}
