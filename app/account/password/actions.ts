"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, isStrongEnoughPassword, verifyPassword } from "@/lib/password";
import { recordAudit } from "@/lib/audit";

export async function changePasswordAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next !== confirm) redirect("/account/password?error=mismatch");
  if (!isStrongEnoughPassword(next)) redirect("/account/password?error=short");

  const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!user.mustChangePassword && !verifyPassword(current, record.passwordHash)) redirect("/account/password?error=current");
  if (verifyPassword(next, record.passwordHash)) redirect("/account/password?error=same");

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next), mustChangePassword: false } });
  await recordAudit({ actorUserId: user.id, actorLabel: "user", action: "user.password-changed" });
  redirect(homeFor({ ...user, mustChangePassword: false }));
}
