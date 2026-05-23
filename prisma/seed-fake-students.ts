// Dev-only fixture: pushes 10 fake students into each named batch with
// random payment progress. Run:
//   npm run db:seed:fake -- M30 M32
// Idempotent on student email (uses upsert by email).

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient, type DocType, type PaymentMethod } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
});

const FIRST = [
  "Aisha", "Bilal", "Carla", "Diana", "Eduardo",
  "Fatima", "Gustavo", "Hassan", "Inês", "Jamal",
  "Karim", "Luísa", "Mariana", "Nadia", "Omar",
  "Patrícia", "Quentin", "Rita", "Saif", "Tomás",
];
const LAST = [
  "Silva", "Santos", "Ferreira", "Costa", "Pereira",
  "Khan", "Ahmed", "Rodrigues", "Oliveira", "Hossain",
  "Rahman", "Martins", "Almeida", "Carvalho", "Hussain",
];
const NATIONALITIES = ["Bangladesh", "Pakistan", "Brasil", "Cabo Verde", "Angola", "Portugal", "Síria"];
const CITIES = ["Porto", "Vila Nova de Gaia", "Matosinhos", "Maia", "Gondomar"];
const STREETS = ["Rua das Flores", "Av. da República", "Rua de Santa Catarina", "Rua do Almada", "Rua Sá da Bandeira"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type PaymentScenario = "unpaid" | "partial" | "full" | "split";

const SCENARIOS: PaymentScenario[] = [
  "unpaid", "unpaid",
  "partial", "partial",
  "full", "full", "full", "full",
  "split", "split",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function seedOneBatch(batchCode: string) {
  const batch = await prisma.batch.findUnique({
    where: { code: batchCode },
    include: { course: { select: { feeCents: true } } },
  });
  if (!batch) {
    console.warn(`✗ Batch ${batchCode} not found — skipping.`);
    return;
  }
  console.log(`\n=== ${batchCode} (fee €${batch.course.feeCents / 100}) ===`);

  const scenarios = shuffle(SCENARIOS);

  for (let i = 0; i < 10; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const safeFirst = first
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z]/g, "");
    const safeLast = last
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z]/g, "");
    const email = `${safeFirst}.${safeLast}.${batchCode.toLowerCase()}.${i}@example.test`;
    const phone = `+351 9${pick(["1", "2", "3", "6"])} ${rand(100, 999)} ${rand(1000, 9999)}`;
    const docNum = `${rand(100000, 999999)}`;
    const fullName = `${first} ${last}`;

    const student = await prisma.student.upsert({
      where: { email },
      create: {
        fullName,
        email,
        phone,
        docType: "PASSPORT" as DocType,
        docNumber: docNum,
        dob: new Date(`19${rand(80, 99)}-${String(rand(1, 12)).padStart(2, "0")}-${String(rand(1, 28)).padStart(2, "0")}`),
        docExpiry: new Date(`203${rand(0, 5)}-${String(rand(1, 12)).padStart(2, "0")}-${String(rand(1, 28)).padStart(2, "0")}`),
        nationality: pick(NATIONALITIES),
        nif: String(rand(100_000_000, 999_999_999)),
        niss: rand(0, 1) ? String(rand(10_000_000_000, 99_999_999_999)) : null,
        address: `${pick(STREETS)}, ${rand(1, 500)}`,
        city: pick(CITIES),
        gdprConsentAt: new Date(),
      },
      update: {},
    });

    const existing = await prisma.enrollment.findUnique({
      where: { studentId_batchId: { studentId: student.id, batchId: batch.id } },
    });
    let enrollmentId: string;
    if (existing) {
      enrollmentId = existing.id;
    } else {
      const enrollment = await prisma.enrollment.create({
        data: { studentId: student.id, batchId: batch.id },
      });
      enrollmentId = enrollment.id;
    }

    // Skip if any payment already exists (re-run safety).
    const already = await prisma.payment.findFirst({ where: { enrollmentId } });
    if (already) {
      console.log(`  • ${fullName.padEnd(26)} → existing payments, skipping`);
      continue;
    }

    const scenario = scenarios[i];
    const fee = batch.course.feeCents;
    let payments: Array<{ amount: number; method: PaymentMethod; daysAgo: number }> = [];
    switch (scenario) {
      case "unpaid":
        payments = [];
        break;
      case "partial":
        payments = [{ amount: Math.round(fee * (0.3 + Math.random() * 0.4)), method: pick(["BANK", "CASH"]) as PaymentMethod, daysAgo: rand(1, 30) }];
        break;
      case "full":
        payments = [{ amount: fee, method: pick(["BANK", "CASH"]) as PaymentMethod, daysAgo: rand(1, 60) }];
        break;
      case "split": {
        const first = Math.round(fee * (0.35 + Math.random() * 0.2));
        const second = fee - first;
        payments = [
          { amount: first, method: "BANK", daysAgo: rand(20, 50) },
          { amount: second, method: pick(["BANK", "CASH"]) as PaymentMethod, daysAgo: rand(1, 15) },
        ];
        break;
      }
    }

    for (const p of payments) {
      const paidAt = new Date();
      paidAt.setUTCDate(paidAt.getUTCDate() - p.daysAgo);
      await prisma.payment.create({
        data: {
          enrollmentId,
          amountCents: p.amount,
          method: p.method,
          paidAt,
          notes: `Seed (${scenario})`,
        },
      });
    }

    const total = payments.reduce((a, p) => a + p.amount, 0);
    if (total > 0) {
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { status: "ACTIVE" },
      });
    }
    console.log(`  • ${fullName.padEnd(26)} → ${scenario} · €${(total / 100).toFixed(2)} / €${(fee / 100).toFixed(2)}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: tsx prisma/seed-fake-students.ts <batchCode> [<batchCode> ...]");
    process.exit(1);
  }
  for (const code of args) {
    await seedOneBatch(code);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
