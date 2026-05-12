// Idempotent seed: PLA course + 6 modules. Safe to run on dev and prod.
//
// Optional dev-only admin user creation lives in prisma/seed-dev-admin.ts and
// is invoked explicitly (`npm run db:seed:admin`) — never auto-run.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

const PLA_MODULES = [
  "Eu e a minha rotina diária",
  "Hábitos alimentares, cultura e lazer",
  "O corpo humano, saúde e serviços",
  "Eu e o mundo do trabalho",
  "O meu passado e o meu presente",
  "Comunicação e vida em sociedade",
];

async function main() {
  // Course
  const course = await prisma.course.upsert({
    where: { code: "PLA" },
    create: {
      code: "PLA",
      name: "Português Língua de Acolhimento",
      level: "A1+A2",
      totalHours: 150,
    },
    update: {},
  });
  console.log(`✓ Course: ${course.code} (${course.id})`);

  // Modules — upsert by composite (courseId, number)
  for (let i = 0; i < PLA_MODULES.length; i++) {
    const number = i + 1;
    const name = PLA_MODULES[i];
    const mod = await prisma.module.upsert({
      where: {
        courseId_number: { courseId: course.id, number },
      },
      create: {
        courseId: course.id,
        number,
        name,
      },
      update: { name },
    });
    console.log(`  • Module ${number}: ${mod.name}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
