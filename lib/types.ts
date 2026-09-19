import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  isActive: boolean;
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

export function isForeman(user: SessionUser) {
  return hasRole(user, "FOREMAN");
}
