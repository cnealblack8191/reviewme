/**
 * Reminder schedule. Run from cron once a day:
 *   node --env-file-if-exists=.env scripts/send-reminders.mjs
 * Workers with an unopened or unused self-eval link older than
 * CompanySettings.reminderEmployeeDays get a nudge; supervisors with unstarted
 * reviews older than reminderSupervisorDays get one too. Respects remindersEnabled.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const settings = await prisma.companySettings.findUnique({ where: { id: "eci" } });
  if (!settings?.remindersEnabled) {
    console.log("Reminders disabled in settings.");
    return;
  }
  const cutoff = new Date(Date.now() - settings.reminderEmployeeDays * 86400000);
  const stale = await prisma.reviewLink.findMany({
    where: { kind: "SELF_EVAL", usedAt: null, voidedAt: null, lockedAt: null, expiresAt: { gt: new Date() }, createdAt: { lt: cutoff } },
    include: { review: { include: { employee: true } } }
  });
  console.log(`${stale.length} worker reminders due. Sending is wired through lib/messaging once this script moves to a server action or a compiled entry point.`);
  // TODO: call deliver() for each. Kept as a report until the messaging providers are configured.
}

main().finally(() => prisma.$disconnect());
