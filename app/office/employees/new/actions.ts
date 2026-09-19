"use server";

import { redirect } from "next/navigation";
import type { Language } from "@prisma/client";
import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/password";
import { recordAudit } from "@/lib/audit";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createEmployeeAction(formData: FormData) {
  const user = await requireOffice();

  const phone = text(formData, "phone");
  const digits = phone.replace(/\D/g, "");
  const ssnLast4 = text(formData, "ssnLast4");
  const language = (text(formData, "language") === "ES" ? "ES" : "EN") as Language;
  const templateId = text(formData, "templateId");
  const reviewerId = text(formData, "reviewerId");
  const hireDate = text(formData, "hireDate");

  if (!templateId || !reviewerId) redirect("/office/employees/new?error=Choose+a+review+form+and+a+reviewer");

  const employee = await prisma.employee.create({
    data: {
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      phone: phone || null,
      phoneLast4: digits.length >= 4 ? digits.slice(-4) : null,
      ssnLast4Hash: /^\d{4}$/.test(ssnLast4) ? hashSecret(ssnLast4) : null,
      email: text(formData, "email").toLowerCase() || null,
      position: text(formData, "position"),
      iecStatus: text(formData, "iecStatus") || null,
      hireDate: hireDate ? new Date(hireDate) : null,
      jobSite: text(formData, "jobSite") || null,
      language,
      templateId,
      reviewerId
    }
  });

  if (formData.get("includeInPeriod")) {
    const period = await prisma.reviewPeriod.findFirst({ where: { closedAt: null }, orderBy: { opensAt: "desc" } });
    if (period) {
      const review = await prisma.review.create({
        data: { periodId: period.id, employeeId: employee.id, supervisorId: reviewerId, templateId, language }
      });
      await recordAudit({ reviewId: review.id, actorUserId: user.id, actorLabel: "office", action: "review.created", newValue: period.name });
    }
  }

  redirect("/office/employees/new?saved=1");
}
