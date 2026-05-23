// One-off: seed demo exam content + schedule one demo exam session.
//
// Idempotent — re-running won't duplicate. Uses upsert by the unique
// (courseId, moduleId) and skips if the module already has questions.
//
// Run: npx tsx prisma/seed-demo-exams.ts

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

// Three sample questions per module — one of each type. Pulled from
// generic PLA-style content so they feel real without being final.
const DEMO_QUESTIONS_BY_MODULE_NUMBER: Record<
  number,
  Array<
    | {
        type: "MC";
        prompt: string;
        points: number;
        choices: string[];
        correctIndex: number;
      }
    | { type: "FILL"; prompt: string; points: number; acceptedAnswers: string[] }
    | { type: "OPEN"; prompt: string; points: number }
  >
> = {
  1: [
    {
      type: "MC",
      prompt: "Como se diz \"Good morning\" em português?",
      points: 1,
      choices: ["Boa tarde", "Bom dia", "Boa noite", "Olá"],
      correctIndex: 1,
    },
    {
      type: "FILL",
      prompt: "Complete: \"Eu ___ português.\" (verb: to study)",
      points: 1,
      acceptedAnswers: ["estudo"],
    },
    {
      type: "OPEN",
      prompt:
        "Apresente-se em duas frases: como se chama e onde mora.",
      points: 3,
    },
  ],
  2: [
    {
      type: "MC",
      prompt: "Qual destes alimentos é típico do pequeno-almoço português?",
      points: 1,
      choices: ["Bacalhau", "Pastel de nata", "Caldo verde", "Francesinha"],
      correctIndex: 1,
    },
    {
      type: "FILL",
      prompt: "Complete: \"Eu ___ café todas as manhãs.\" (verb: to drink)",
      points: 1,
      acceptedAnswers: ["bebo"],
    },
    {
      type: "OPEN",
      prompt: "Descreva uma refeição típica do seu país de origem.",
      points: 3,
    },
  ],
  3: [
    {
      type: "MC",
      prompt: "Onde se vai para tirar uma vacina em Portugal?",
      points: 1,
      choices: ["Junta de Freguesia", "Centro de Saúde", "Loja do Cidadão", "Câmara Municipal"],
      correctIndex: 1,
    },
    {
      type: "FILL",
      prompt: "Complete: \"Estou com ___ de cabeça.\" (noun: pain/ache)",
      points: 1,
      acceptedAnswers: ["dor", "dores"],
    },
    {
      type: "OPEN",
      prompt:
        "Escreva um diálogo curto entre um paciente e um médico (4–6 falas).",
      points: 4,
    },
  ],
  4: [
    {
      type: "MC",
      prompt: "Qual destes documentos precisa para trabalhar em Portugal?",
      points: 1,
      choices: ["NIF", "Passaporte", "NISS", "Todos os anteriores"],
      correctIndex: 3,
    },
    {
      type: "FILL",
      prompt: "Complete: \"Eu ___ a procurar emprego.\" (verb: to be, gerund)",
      points: 1,
      acceptedAnswers: ["estou"],
    },
    {
      type: "OPEN",
      prompt:
        "Descreva o seu emprego ideal e o porquê (mínimo 4 frases).",
      points: 4,
    },
  ],
  5: [
    {
      type: "MC",
      prompt: "Qual é o pretérito perfeito de \"eu vou\"?",
      points: 1,
      choices: ["Eu fui", "Eu ia", "Eu vou", "Eu irei"],
      correctIndex: 0,
    },
    {
      type: "FILL",
      prompt: "Complete: \"Ontem ___ ao cinema.\" (eu, verb: to go, past)",
      points: 1,
      acceptedAnswers: ["fui"],
    },
    {
      type: "OPEN",
      prompt:
        "Conte uma memória da sua infância no seu país (mínimo 5 frases).",
      points: 4,
    },
  ],
  6: [
    {
      type: "MC",
      prompt: "Como se cumprimenta formalmente em português?",
      points: 1,
      choices: ["Olá!", "Tudo bem?", "Bom dia, como está?", "E aí?"],
      correctIndex: 2,
    },
    {
      type: "FILL",
      prompt: "Complete: \"Por favor, ___ ajudar-me?\" (verb: to be able, you formal)",
      points: 1,
      acceptedAnswers: ["pode", "podia", "poderia"],
    },
    {
      type: "OPEN",
      prompt:
        "Escreva uma carta formal de apresentação a uma escola ou empresa em Portugal (mínimo 6 frases).",
      points: 5,
    },
  ],
};

async function main() {
  // Find PLA (the only course today). The exam authoring is keyed by
  // (courseId, moduleId), so we don't need to hardcode any UUIDs.
  const course = await prisma.course.findFirst({
    where: { code: "PLA" },
    include: { modules: { orderBy: { number: "asc" } } },
  });
  if (!course) {
    console.error("No PLA course found. Run npm run db:seed first.");
    process.exit(1);
  }
  console.log(`Course: ${course.code} (${course.id})`);
  console.log(`Modules: ${course.modules.length}`);

  // ---- Author/seed exams + questions ----------------------------------
  for (const mod of course.modules) {
    const sampleSet = DEMO_QUESTIONS_BY_MODULE_NUMBER[mod.number];
    if (!sampleSet) {
      console.log(`  M${mod.number}: no demo questions defined, skipping.`);
      continue;
    }

    const exam = await prisma.exam.upsert({
      where: {
        courseId_moduleId: { courseId: course.id, moduleId: mod.id },
      },
      create: {
        courseId: course.id,
        moduleId: mod.id,
        title: `M${mod.number} — ${mod.name}`,
        passingScore: 60,
        durationMinutes: 30,
      },
      update: {},
      include: { questions: true },
    });

    if (exam.questions.length > 0) {
      console.log(
        `  M${mod.number}: ${exam.questions.length} questions already authored, skipping seed.`,
      );
      continue;
    }

    await prisma.examQuestion.createMany({
      data: sampleSet.map((q, i) => {
        if (q.type === "MC") {
          return {
            examId: exam.id,
            position: i,
            type: "MC" as const,
            prompt: q.prompt,
            points: q.points,
            choices: q.choices,
            correctIndex: q.correctIndex,
            acceptedAnswers: [],
          };
        }
        if (q.type === "FILL") {
          return {
            examId: exam.id,
            position: i,
            type: "FILL" as const,
            prompt: q.prompt,
            points: q.points,
            choices: [],
            correctIndex: null,
            acceptedAnswers: q.acceptedAnswers,
          };
        }
        return {
          examId: exam.id,
          position: i,
          type: "OPEN" as const,
          prompt: q.prompt,
          points: q.points,
          choices: [],
          correctIndex: null,
          acceptedAnswers: [],
        };
      }),
    });
    console.log(`  M${mod.number}: seeded ${sampleSet.length} questions.`);
  }

  // ---- Schedule one demo exam session ---------------------------------
  // Pick the first ACTIVE batch on this course; otherwise the most recent.
  const batch =
    (await prisma.batch.findFirst({
      where: { courseId: course.id, status: "ACTIVE" },
      orderBy: { startDate: "desc" },
    })) ??
    (await prisma.batch.findFirst({
      where: { courseId: course.id },
      orderBy: { startDate: "desc" },
    }));
  if (!batch) {
    console.log("\nNo batch available to schedule a demo exam against. Skipping.");
    await prisma.$disconnect();
    return;
  }
  console.log(`\nBatch to demo against: ${batch.code} (${batch.id})`);

  // Schedule M1's exam for today so students can take it right away.
  const m1 = course.modules.find((m) => m.number === 1);
  const m1Exam = m1
    ? await prisma.exam.findUnique({
        where: { courseId_moduleId: { courseId: course.id, moduleId: m1.id } },
      })
    : null;
  if (!m1 || !m1Exam) {
    console.log("M1 exam missing; skipping schedule step.");
    await prisma.$disconnect();
    return;
  }

  // Avoid stacking duplicate EXAM sessions.
  const existing = await prisma.batchSession.findFirst({
    where: { batchId: batch.id, moduleId: m1.id, kind: "EXAM" },
  });
  if (existing) {
    console.log(
      `  Demo exam session already exists (id ${existing.id}, ${existing.scheduledDate.toISOString().slice(0, 10)}). Leaving as-is.`,
    );
  } else {
    const maxSeq = await prisma.batchSession.aggregate({
      where: { batchId: batch.id, moduleId: m1.id },
      _max: { sequenceInModule: true },
    });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const created = await prisma.batchSession.create({
      data: {
        batchId: batch.id,
        moduleId: m1.id,
        sequenceInModule: (maxSeq._max.sequenceInModule ?? 0) + 1,
        scheduledDate: today,
        startTime: "14:00",
        endTime: "14:30",
        hours: 1,
        kind: "EXAM",
        examId: m1Exam.id,
      },
    });
    console.log(
      `  Demo exam session scheduled for today (id ${created.id}). Students can hit /student/exams/${created.id}/take`,
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
