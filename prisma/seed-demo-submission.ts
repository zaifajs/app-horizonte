// One-off: insert a fake ExamSubmission for the demo M1 exam session so the
// teacher grading queue has something to render against. Used for P5 demo
// verification before any real student account exists.
//
// Re-running clears the existing demo submission first so the script is
// idempotent. Run: npx tsx prisma/seed-demo-submission.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

async function main() {
  // The demo session was scheduled against M32 for module M1. Find it via
  // the only EXAM-kind session that exists today; if there are multiple,
  // pick the most recent.
  const session = await prisma.batchSession.findFirst({
    where: { kind: "EXAM" },
    orderBy: { createdAt: "desc" },
    include: {
      exam: { include: { questions: { orderBy: { position: "asc" } } } },
      batch: { include: { enrollments: { include: { student: true } } } },
    },
  });
  if (!session || !session.exam) {
    console.error("No EXAM session found. Run seed-demo-exams.ts first.");
    process.exit(1);
  }
  // Pick the first ACTIVE enrolment as our fake test-taker.
  const enr = session.batch.enrollments.find((e) => e.status === "ACTIVE");
  if (!enr) {
    console.error("No ACTIVE enrolment on the batch. Can't seed a submission.");
    process.exit(1);
  }
  const student = enr.student;
  console.log(`Demo session: ${session.id}`);
  console.log(`Test student: ${student.fullName} (${student.email})`);

  // Wipe any existing demo submission for this student+session so the
  // script is re-runnable.
  await prisma.examSubmission.deleteMany({
    where: { studentId: student.id, batchSessionId: session.id },
  });

  // Compose plausible answers — MC picks the correct index, FILL nails it,
  // OPEN is a real paragraph the teacher can grade.
  let autoScore = 0;
  const answers: {
    questionId: string;
    answerIndex: number | null;
    answerText: string | null;
    pointsAwarded: number | null;
  }[] = [];
  for (const q of session.exam.questions) {
    if (q.type === "MC") {
      // Get it right.
      const correct = q.correctIndex ?? 0;
      autoScore += q.points;
      answers.push({
        questionId: q.id,
        answerIndex: correct,
        answerText: null,
        pointsAwarded: q.points,
      });
    } else if (q.type === "FILL") {
      const accepted = (q.acceptedAnswers as string[]) ?? [];
      const pick = accepted[0] ?? "";
      autoScore += q.points;
      answers.push({
        questionId: q.id,
        answerIndex: null,
        answerText: pick,
        pointsAwarded: q.points,
      });
    } else {
      // OPEN — leave pointsAwarded null so the grading queue picks it up.
      answers.push({
        questionId: q.id,
        answerIndex: null,
        answerText:
          "Olá! Chamo-me Aisha Martins e moro em Lisboa, em Portugal. Sou bangladechiana e mudei-me há dois anos para estudar e trabalhar. Adoro aprender português e conhecer pessoas novas.",
        pointsAwarded: null,
      });
    }
  }

  const submission = await prisma.examSubmission.create({
    data: {
      studentId: student.id,
      batchSessionId: session.id,
      autoScore,
      status: "SUBMITTED",
      submittedAt: new Date(),
      answers: { create: answers },
    },
    include: { answers: true },
  });

  console.log(
    `Created submission ${submission.id} · autoScore ${autoScore} · ${submission.answers.length} answers stored.`,
  );
  console.log(`\nGrade it at:`);
  console.log(`  /teacher/exams/${session.id}/grade`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
