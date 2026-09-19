"use server";

import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { generateTemporaryPassword, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { recordAudit } from "@/lib/audit";

const VALID_ROLES: Role[] = ["FOREMAN", "PROJECT_MANAGER", "SENIOR_MANAGER", "OFFICE", "ADMIN"];

function rolesFrom(formData: FormData) {
  return formData.getAll("roles").map(String).filter((r): r is Role => (VALID_ROLES as string[]).includes(r));
}

export async function createUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roles = rolesFrom(formData);
  if (!name || !email) redirect("/office/users?error=Name+and+email+are+required");
  if (roles.length === 0) redirect("/office/users?error=Pick+at+least+one+role");
  if (await prisma.user.findUnique({ where: { email } })) redirect(`/office/users?error=${encodeURIComponent(`${email} already has an account`)}`);

  const temp = generateTemporaryPassword();
  const user = await prisma.user.create({ data: { name, email, roles, passwordHash: hashPassword(temp), mustChangePassword: true } });
  await recordAudit({ actorUserId: admin.id, actorLabel: "admin", action: "user.created", newValue: `${user.email} · ${roles.join(",")}` });
  redirect(`/office/users?created=1&email=${encodeURIComponent(email)}&temp=${encodeURIComponent(temp)}`);
}

export async function resetPasswordAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const temp = generateTemporaryPassword();
  const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(temp), mustChangePassword: true } });
  await recordAudit({ actorUserId: admin.id, actorLabel: "admin", action: "user.password-reset", newValue: user.email });
  redirect(`/office/users?email=${encodeURIComponent(user.email)}&temp=${encodeURIComponent(temp)}`);
}

export async function setUserActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (userId === admin.id) redirect("/office/users?error=You+cannot+deactivate+yourself");
  const active = String(formData.get("active")) === "1";
  const user = await prisma.user.update({ where: { id: userId }, data: { isActive: active } });
  await recordAudit({ actorUserId: admin.id, actorLabel: "admin", action: active ? "user.reactivated" : "user.deactivated", newValue: user.email });
  redirect("/office/users?saved=1");
}

export async function updateRolesAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  let roles = rolesFrom(formData);
  if (userId === admin.id && !roles.includes("ADMIN")) roles = [...roles, "ADMIN"];
  if (roles.length === 0) redirect("/office/users?error=A+user+needs+at+least+one+role");
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { roles: true, email: true } });
  await prisma.user.update({ where: { id: userId }, data: { roles } });
  await recordAudit({ actorUserId: admin.id, actorLabel: "admin", action: "user.roles", field: before.email, oldValue: before.roles.join(","), newValue: roles.join(",") });
  redirect("/office/users?saved=1");
}
