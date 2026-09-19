import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  isActive: boolean;
  mustChangePassword: boolean;
}

export function hasRole(user: SessionUser, role: Role) {
  return user.roles.includes(role);
}

export function isOffice(user: SessionUser) {
  return hasRole(user, "OFFICE") || hasRole(user, "ADMIN");
}

export function isAdmin(user: SessionUser) {
  return hasRole(user, "ADMIN");
}

export const REVIEWER_ROLES: Role[] = ["FOREMAN", "PROJECT_MANAGER", "SENIOR_MANAGER"];

/** Anyone who completes reviews for assigned employees: foremen and the managers who review foremen. */
export function isReviewer(user: SessionUser) {
  return REVIEWER_ROLES.some((role) => hasRole(user, role));
}

export function roleLabel(role: Role) {
  switch (role) {
    case "FOREMAN": return "Foreman";
    case "PROJECT_MANAGER": return "Project Manager";
    case "SENIOR_MANAGER": return "Senior Manager";
    case "OFFICE": return "Office";
    case "ADMIN": return "Admin";
  }
}
