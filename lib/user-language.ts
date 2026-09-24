import type { Language } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function userLanguage(userId: string): Promise<Language> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { language: true } });
  return row?.language ?? "EN";
}
