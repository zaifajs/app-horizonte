// Dev/demo-only: creates a Supabase auth user for a seeded fake student so
// you can log in and walk the /student/* surface end to end without going
// through the email-invite flow (which is blocked when the student's email
// is a non-deliverable @example.test address).
//
// Usage:
//   SEED_STUDENT_EMAIL=aisha.martins.m32.0@example.test \
//     npx tsx prisma/seed-demo-student-login.ts
//
// If no email is provided, picks the first ACTIVE enrolment on M32.
//
// Generates a random 12-character password and prints it ONCE to stdout.
// Idempotent: if the auth user already exists, the script resets the
// password (so you can re-run if you lost it) and re-links the Student row.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

const dbUrl = process.env.DATABASE_URL;
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dbUrl) throw new Error("DATABASE_URL is not set");
if (!supaUrl || !supaKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
});
const supabase = createClient(supaUrl, supaKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function randomPassword(): string {
  // 12 base64url-ish characters, no padding or symbols that confuse SSH copy.
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "x").slice(0, 12);
}

async function main() {
  const requested = process.env.SEED_STUDENT_EMAIL?.toLowerCase().trim();
  const student = requested
    ? await prisma.student.findUnique({ where: { email: requested } })
    : await prisma.student
        .findFirst({
          where: {
            enrollments: {
              some: { status: "ACTIVE", batch: { code: "M32" } },
            },
          },
          orderBy: { fullName: "asc" },
        });
  if (!student) {
    console.error(
      requested
        ? `No student found with email ${requested}`
        : "No ACTIVE student on M32 found. Pass SEED_STUDENT_EMAIL.",
    );
    process.exit(1);
  }
  const email = student.email.toLowerCase();
  console.log(`Target student: ${student.fullName} <${email}>`);

  // Generate (or rotate) the password every run.
  const password = randomPassword();

  // 1. Create or update the Supabase auth user. listUsers paginates;
  //    fine for our scale (<200 users).
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  let authUser = list?.users.find((u) => u.email === email);
  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email verification — this is a dev seed.
      user_metadata: { name: student.fullName, role: "STUDENT" },
    });
    if (error) throw error;
    authUser = data.user!;
    console.log(`✓ Created Supabase auth user: ${authUser.id}`);
  } else {
    const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      user_metadata: { name: student.fullName, role: "STUDENT" },
    });
    if (error) throw error;
    console.log(`✓ Re-used existing auth user, password rotated: ${authUser.id}`);
  }

  // 2. Upsert our internal users row + link Student.userId.
  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: authUser!.id },
      create: {
        id: authUser!.id,
        email,
        name: student.fullName,
        role: "STUDENT",
      },
      update: {
        email,
        name: student.fullName,
        role: "STUDENT",
        isActive: true,
      },
    });
    await tx.student.update({
      where: { id: student.id },
      data: { userId: authUser!.id },
    });
  });
  console.log("✓ users row + Student.userId linked.");

  console.log("\n=================================================");
  console.log("  Demo student credentials (shown once):");
  console.log("  ----------------------------------------");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("  ----------------------------------------");
  console.log("  Log in at: /login");
  console.log("  Lands on:  /student");
  console.log("=================================================\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
