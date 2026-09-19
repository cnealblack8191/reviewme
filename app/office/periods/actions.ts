"use server";

import { redirect } from "next/navigation";
import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

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
