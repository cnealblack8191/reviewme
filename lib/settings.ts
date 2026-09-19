import { prisma } from "@/lib/prisma";

export async function getSettings() {
  return prisma.companySettings.upsert({
    where: { id: "eci" },
    update: {},
    create: { id: "eci" }
  });
}
