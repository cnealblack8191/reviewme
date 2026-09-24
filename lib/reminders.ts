/**
 * Reminder job. Runs once a day from cron through /api/cron/reminders.
 *
 *  Workers    an open self-eval or sign link older than reminderEmployeeDays with no
 *             reminder in that window gets the same link again, by the channel it
 *             was first sent on. Texts only inside quiet hours; email any time.
 *  Reviewers  a supervisor with unsubmitted reviews older than reminderSupervisorDays,
 *             or an approved review not yet marked Discussed, gets one email listing them.
 */
import type { Language, MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { decryptToken, linkUrl } from "@/lib/links";
import { deliver } from "@/lib/messaging";
import { appBaseUrl } from "@/lib/env";

const DAY = 24 * 60 * 60 * 1000;

export interface ReminderRun {
  ranAt: string;
  skipped?: string;
  workersReminded: number;
  workersDeferredQuietHours: number;
  reviewersReminded: number;
  details: string[];
}

function hourIn(timezone: string, at: Date) {
  const text = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone }).format(at);
  return Number(text) % 24;
}

function workerText(lang: Language, kind: "SELF_EVAL" | "SIGN", url: string, expires: Date) {
  const date = expires.toLocaleDateString(lang === "ES" ? "es-US" : "en-US", { month: "short", day: "numeric" });
  if (lang === "ES") {
    return kind === "SIGN"
      ? `ECI ReviewMe: recordatorio, su evaluación está lista para leer y firmar. Enlace privado, vence ${date}: ${url} Responda STOP para cancelar.`
      : `ECI ReviewMe: recordatorio, complete su autoevaluación. Enlace privado, vence ${date}: ${url} Responda STOP para cancelar.`;
  }
  return kind === "SIGN"
    ? `ECI ReviewMe: reminder, your review is ready to read and sign. Private link, expires ${date}: ${url} Reply STOP to opt out.`
    : `ECI ReviewMe: reminder, please complete your self-evaluation. Private link, expires ${date}: ${url} Reply STOP to opt out.`;
}

export async function runReminders(now = new Date(), options: { force?: boolean } = {}): Promise<ReminderRun> {
  const settings = await getSettings();
  const run: ReminderRun = { ranAt: now.toISOString(), workersReminded: 0, workersDeferredQuietHours: 0, reviewersReminded: 0, details: [] };

  if (!settings.remindersEnabled && !options.force) {
    run.skipped = "reminders disabled in company settings";
    return run;
  }

  const hour = hourIn(settings.timezone, now);
  const smsAllowedNow = options.force || (hour >= settings.reminderQuietStartHour && hour < settings.reminderQuietEndHour);

  // ---- Workers ----
  const employeeCutoff = new Date(now.getTime() - settings.reminderEmployeeDays * DAY);
  const openLinks = await prisma.reviewLink.findMany({
    where: {
      usedAt: null, voidedAt: null, lockedAt: null,
      expiresAt: { gt: now },
      createdAt: { lt: employeeCutoff },
      tokenCiphertext: { not: null },
      channel: { in: ["SMS", "EMAIL"] },
      review: { period: { closedAt: null } }
    },
    include: { review: { include: { employee: true, messages: { where: { purpose: "reminder:employee" }, orderBy: { createdAt: "desc" }, take: 1 } } } }
  });

  for (const link of openLinks) {
    const last = link.review.messages[0]?.createdAt;
    if (last && last > employeeCutoff) continue;
    const token = decryptToken(link.tokenCiphertext!);
    if (!token) {
      run.details.push(`link ${link.id}: could not decrypt token`);
      continue;
    }
    const employee = link.review.employee;
    let channel: MessageChannel = link.channel;
    let to = channel === "SMS" ? employee.phone : employee.email;
    if (channel === "SMS" && !smsAllowedNow) {
      if (employee.email) {
        channel = "EMAIL";
        to = employee.email;
      } else {
        run.workersDeferredQuietHours += 1;
        continue;
      }
    }
    if (!to) continue;

    const lang = link.review.language;
    const body = workerText(lang, link.kind, linkUrl(token), link.expiresAt);
    const subject = lang === "ES" ? "Recordatorio: su evaluación de ECI" : "Reminder: your ECI review";
    const result = await deliver({ channel, to, body, subject, purpose: "reminder:employee", reviewId: link.reviewId, employeeId: employee.id });
    run.workersReminded += 1;
    run.details.push(`worker ${employee.firstName} ${employee.lastName} · ${link.kind} · ${channel} · ${result.status}`);
  }

  // ---- Reviewers ----
  const supervisorCutoff = new Date(now.getTime() - settings.reminderSupervisorDays * DAY);
  const pending = await prisma.review.findMany({
    where: {
      period: { closedAt: null },
      OR: [
        { status: { in: ["OPEN", "SENT_BACK"] }, supervisorStatus: { not: "SUBMITTED" }, createdAt: { lt: supervisorCutoff } },
        { status: "APPROVED", approvedAt: { lt: new Date(now.getTime() - 3 * DAY) } }
      ]
    },
    include: { employee: true, supervisor: true, messages: { where: { purpose: "reminder:supervisor" }, orderBy: { createdAt: "desc" }, take: 1 } }
  });

  const bySupervisor = new Map<string, typeof pending>();
  for (const review of pending) {
    if (review.messages[0] && review.messages[0].createdAt > supervisorCutoff) continue;
    const list = bySupervisor.get(review.supervisorId) ?? [];
    list.push(review);
    bySupervisor.set(review.supervisorId, list);
  }

  const base = appBaseUrl();
  for (const [, reviews] of bySupervisor) {
    const supervisor = reviews[0].supervisor;
    if (!supervisor.email || !supervisor.isActive) continue;
    const toComplete = reviews.filter((r) => r.status !== "APPROVED");
    const toDiscuss = reviews.filter((r) => r.status === "APPROVED");
    const lines = [
      `Hi ${supervisor.name.split(" ")[0]},`,
      "",
      toComplete.length ? `Reviews waiting on you (${toComplete.length}):` : "",
      ...toComplete.map((r) => `  • ${r.employee.firstName} ${r.employee.lastName} · ${r.employee.position}`),
      toDiscuss.length ? `\nApproved, meet the employee and tap Discussed (${toDiscuss.length}):` : "",
      ...toDiscuss.map((r) => `  • ${r.employee.firstName} ${r.employee.lastName}`),
      "",
      `Open ReviewMe: ${base}/me`,
      "",
      "ReviewMe · Electrical Contractor Inc."
    ].filter((l) => l !== "");
    const result = await deliver({
      channel: "EMAIL",
      to: supervisor.email,
      subject: `ReviewMe: ${reviews.length} review${reviews.length === 1 ? "" : "s"} need your attention`,
      body: lines.join("\n"),
      purpose: "reminder:supervisor",
      reviewId: reviews[0].id
    });
    // Log the reminder against every review it covered so the dedupe window applies to each.
    for (const r of reviews.slice(1)) {
      await prisma.messageLog.create({ data: { reviewId: r.id, channel: "EMAIL", to: supervisor.email, purpose: "reminder:supervisor", status: result.status, providerId: result.providerId } });
    }
    run.reviewersReminded += 1;
    run.details.push(`reviewer ${supervisor.name} · ${reviews.length} reviews · ${result.status}`);
  }

  return run;
}
