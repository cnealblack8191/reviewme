"use server";

import { revalidatePath } from "next/cache";
import { requireReviewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markDiscussed, markSignLinkSent } from "@/lib/reviews";
import { issueLink } from "@/lib/links";
import { deliver } from "@/lib/messaging";

/** Foreman confirms the face-to-face meeting. That releases the sign link to the worker. */
export async function markDiscussedAction(formData: FormData) {
  const user = await requireReviewer();
  const reviewId = String(formData.get("reviewId") ?? "");

  const review = await prisma.review.findUnique({ where: { id: reviewId }, include: { employee: true } });
  if (!review || review.supervisorId !== user.id || review.status !== "APPROVED") return;

  await markDiscussed(reviewId, user.id);

  const employee = review.employee;
  const channel = employee.phone ? "SMS" : employee.email ? "EMAIL" : null;
  if (channel) {
    const to = channel === "SMS" ? employee.phone! : employee.email!;
    const { url } = await issueLink({ reviewId, kind: "SIGN", channel, sentTo: to, createdById: user.id });
    const body =
      review.language === "ES"
        ? `ECI: su evaluación está lista para leer y firmar. Enlace privado, válido por tiempo limitado: ${url}`
        : `ECI: your review is ready to read and sign. Private link, valid for a limited time: ${url}`;
    await deliver({ channel, to, body, subject: "Your ECI review is ready to sign", purpose: "sign-link", reviewId, employeeId: employee.id });
    await markSignLinkSent(reviewId, user.id);
  }

  revalidatePath("/me");
}
