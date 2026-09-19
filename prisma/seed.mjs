import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set for seeding.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize("NFKC"), salt, 64);
  return `scrypt:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

async function seedSettings() {
  await prisma.companySettings.upsert({
    where: { id: "eci" },
    update: {},
    create: { id: "eci" }
  });
}

async function seedTemplates() {
  const data = JSON.parse(readFileSync(new URL("./templates.json", import.meta.url), "utf8"));

  for (const [index, template] of data.templates.entries()) {
    const record = await prisma.reviewTemplate.upsert({
      where: { key: template.key },
      update: { titleEn: template.title.en, titleEs: template.title.es, sortOrder: index },
      create: { key: template.key, titleEn: template.title.en, titleEs: template.title.es, sortOrder: index }
    });

    for (const [order, criterion] of template.criteria.entries()) {
      await prisma.templateCriterion.upsert({
        where: { templateId_sortOrder: { templateId: record.id, sortOrder: order } },
        update: { labelEn: criterion.en, labelEs: criterion.es },
        create: { templateId: record.id, sortOrder: order, labelEn: criterion.en, labelEs: criterion.es }
      });
    }

    for (const [order, questionKey] of template.selfQuestions.entries()) {
      const question = data.selfQuestions[questionKey];
      await prisma.templateQuestion.upsert({
        where: { templateId_sortOrder: { templateId: record.id, sortOrder: order } },
        update: { key: questionKey, textEn: question.en, textEs: question.es },
        create: { templateId: record.id, sortOrder: order, key: questionKey, textEn: question.en, textEs: question.es }
      });
    }
  }

  return data.templates.length;
}

async function seedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { roles: ["ADMIN", "OFFICE"], isActive: true },
      create: {
        email: adminEmail,
        name: process.env.SEED_ADMIN_NAME?.trim() || "ECI Admin",
        passwordHash: hashPassword(adminPassword),
        roles: ["ADMIN", "OFFICE"]
      }
    });
    console.log(`Admin ready: ${adminEmail}`);
  } else {
    console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set, no admin created.");
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (demoPassword) {
    for (const demo of [
      { email: "office.demo@ecinc.us", name: "Demo Office", roles: ["OFFICE"] },
      { email: "foreman.demo@ecinc.us", name: "Demo Foreman", roles: ["FOREMAN"] }
    ]) {
      await prisma.user.upsert({
        where: { email: demo.email },
        update: { roles: demo.roles, isActive: true },
        create: { ...demo, passwordHash: hashPassword(demoPassword) }
      });
    }
    console.log("Demo office and foreman accounts ready.");
  }
}

async function main() {
  await seedSettings();
  const count = await seedTemplates();
  console.log(`${count} review templates seeded.`);
  await seedUsers();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
