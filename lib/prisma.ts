import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });
}

function client() {
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

// Created on first query, not at import, so `next build` can collect pages without a database.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const value = Reflect.get(client(), property);
    return typeof value === "function" ? value.bind(client()) : value;
  }
});
