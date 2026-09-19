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

const OPEN_STATUSES = ["OPEN", "SENT_BACK", "PENDING_OFFICE", "APPROVED", "DISCUSSED", "SIGN_LINK_SENT"] as const;

export async function updateEmployeeAction(formData: FormData) {
  const user = await requireOffice();
  const employeeId = text(formData, "employeeId");
  const before = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!before) redirect("/office/employees");

  const phone = text(formData, "phone");
  const digits = phone.replace(/\D/g, "");
  const ssnLast4 = text(formData, "ssnLast4");
  const language = (text(formData, "language") === "ES" ? "ES" : "EN") as Language;
  const reviewerId = text(formData, "reviewerId") || before.reviewerId;
  const templateId = text(formData, "templateId") || before.templateId;
  const hireDate = text(formData, "hireDate");

  const data = {
    firstName: text(formData, "firstName") || before.firstName,
    lastName: text(formData, "lastName") || before.lastName,
    phone: phone || null,
    phoneLast4: digits.length >= 4 ? digits.slice(-4) : null,
    ...(/^\d{4}$/.test(ssnLast4) ? { ssnLast4Hash: hashSecret(ssnLast4) } : {}),
    email: text(formData, "email").toLowerCase() || null,
    position: text(formData, "position") || before.position,
    iecStatus: text(formData, "iecStatus") || null,
    hireDate: hireDate ? new Date(hireDate) : null,
    jobSite: text(formData, "jobSite") || null,
    language,
    reviewerId,
    templateId
  };

  await prisma.employee.update({ where: { id: employeeId }, data });

  // Keep the open review in step: reviewer moves with the employee; the form only while untouched.
  const openReview = await prisma.review.findFirst({
    where: { employeeId, status: { in: [...OPEN_STATUSES] }, period: { closedAt: null } },
    orderBy: { createdAt: "desc" }
  });
  if (openReview) {
    const untouched = openReview.supervisorStatus === "NOT_STARTED" && openReview.employeeStatus === "NOT_STARTED";
    const changes: Record<string, unknown> = {};
    if (openReview.supervisorId !== reviewerId) changes.supervisorId = reviewerId;
    if (untouched && openReview.templateId !== templateId) changes.templateId = templateId;
    if (openReview.language !== language && openReview.employeeStatus === "NOT_STARTED") changes.language = language;
    if (Object.keys(changes).length) {
      await prisma.review.update({ where: { id: openReview.id }, data: changes });
      await recordAudit({ reviewId: openReview.id, actorUserId: user.id, actorLabel: "office", action: "review.reassigned", newValue: Object.keys(changes).join(", ") });
    }
  }

  const changed = (Object.keys(data) as Array<keyof typeof data>).filter((k) => k !== "ssnLast4Hash" && String(before[k as keyof typeof before] ?? "") !== String(data[k] ?? ""));
  await recordAudit({ actorUserId: user.id, actorLabel: "office", action: "employee.updated", field: changed.join(", ") || "no changes", newValue: `${data.firstName} ${data.lastName}` });

  redirect(`/office/employees/${employeeId}?saved=1`);
}

export async function setEmployeeActiveAction(formData: FormData) {
  const user = await requireOffice();
  const employeeId = text(formData, "employeeId");
  const active = text(formData, "active") === "1";
  const employee = await prisma.employee.update({ where: { id: employeeId }, data: { isActive: active } });

  if (!active) {
    // Drop reviews nobody has touched; keep anything with work in it for the record.
    const untouched = await prisma.review.findMany({
      where: { employeeId, status: "OPEN", supervisorStatus: "NOT_STARTED", employeeStatus: "NOT_STARTED", links: { none: {} }, period: { closedAt: null } },
      select: { id: true }
    });
    if (untouched.length) await prisma.review.deleteMany({ where: { id: { in: untouched.map((r) => r.id) } } });
    await prisma.reviewLink.updateMany({ where: { review: { employeeId }, usedAt: null, voidedAt: null }, data: { voidedAt: new Date() } });
  }

  await recordAudit({ actorUserId: user.id, actorLabel: "office", action: active ? "employee.reactivated" : "employee.deactivated", newValue: `${employee.firstName} ${employee.lastName}` });
  redirect(`/office/employees/${employeeId}?saved=1`);
}
