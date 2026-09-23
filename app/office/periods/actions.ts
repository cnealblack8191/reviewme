"use server";

import { redirect } from "next/navigation";
import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { closePeriod, reopenPeriod } from "@/lib/reviews";
import { isAdmin } from "@/lib/types";

export async function openPeriodAction(formData: FormData) {
  const user = await requireOffice();
  const name = String(formData.get("name") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  if (!name || !dueDate) return;

  const existing = await prisma.reviewPeriod.findFirst({ where: { closedAt: null } });
  if (existing) redirect("/office/periods");

  const period = await prisma.reviewPeriod.create({ data: { name, dueDate: new Date(dueDate) } });
  const employees = await prisma.employee.findMany({ where: { isActive: true } });

  for (const employee of employees) {
    const review = await prisma.review.create({
      data: { periodId: period.id, employeeId: employee.id, supervisorId: employee.reviewerId, templateId: employee.templateId, language: employee.language }
    });
    await recordAudit({ reviewId: review.id, actorUserId: user.id, actorLabel: "office", action: "review.created", newValue: name });
  }

  redirect("/office");
}

export async function closePeriodAction(formData: FormData) {
  const user = await requireOffice();
  const periodId = String(formData.get("periodId") ?? "");
  const result = await closePeriod(periodId, user.id);
  if (!result.ok) redirect(`/office/periods?error=${encodeURIComponent(`${result.open} review${result.open === 1 ? " is" : "s are"} not finished. Close them first, or deactivate the employee.`)}`);
  redirect(`/office/periods?closed=${result.closed}`);
}

export async function reopenPeriodAction(formData: FormData) {
  const user = await requireOffice();
  if (!isAdmin(user)) redirect("/office/periods?error=Only+an+admin+can+reopen+a+period");
  const periodId = String(formData.get("periodId") ?? "");
  const stillOpen = await prisma.reviewPeriod.findFirst({ where: { closedAt: null } });
  if (stillOpen) redirect("/office/periods?error=Close+the+open+period+first");
  await reopenPeriod(periodId, user.id);
  redirect("/office/periods");
}
