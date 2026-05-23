"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import {
  examSaveSchema,
  scheduleExamSessionSchema,
  gradeExamSubmissionSchema,
  type ExamSaveInput,
  type ScheduleExamSessionInput,
  type GradeExamSubmissionInput,
} from "@/lib/validators/exam";

export type SaveExamResult =
  | { ok: true; examId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Resolve-or-create the Exam row for a module. Used on the editor entry —
// every module has exactly one exam, and we'd rather lazy-create on first
// visit than seed all 6 ahead of time.
export async function getOrCreateExamForModule(moduleId: string) {
  const existing = await prisma.exam.findFirst({
    where: { moduleId },
    include: {
      questions: { orderBy: { position: "asc" } },
      module: { select: { id: true, number: true, name: true, courseId: true } },
    },
  });
  if (existing) return existing;

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, number: true, name: true, courseId: true },
  });
  if (!mod) return null;

  const created = await prisma.exam.create({
    data: {
      courseId: mod.courseId,
      moduleId: mod.id,
      title: `Module ${mod.number} — ${mod.name}`,
      passingScore: 60,
      durationMinutes: 45,
    },
    include: {
      questions: { orderBy: { position: "asc" } },
      module: { select: { id: true, number: true, name: true, courseId: true } },
    },
  });
  return created;
}

// Save-all editor pattern: replaces the question set for an exam in a single
// transaction. Cheaper to reason about than per-question CRUD; safe at the
// expected scale (<20 questions per exam). Audit-logged.
export async function saveExamAction(raw: ExamSaveInput): Promise<SaveExamResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  const parsed = examSaveSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ||= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const mod = await prisma.module.findUnique({
    where: { id: input.moduleId },
    select: { id: true, courseId: true },
  });
  if (!mod) return { ok: false, error: "Module not found." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Upsert by (courseId, moduleId) — the unique key.
      const exam = await tx.exam.upsert({
        where: {
          courseId_moduleId: { courseId: mod.courseId, moduleId: mod.id },
        },
        create: {
          courseId: mod.courseId,
          moduleId: mod.id,
          title: input.title,
          passingScore: input.passingScore,
          durationMinutes: input.durationMinutes,
        },
        update: {
          title: input.title,
          passingScore: input.passingScore,
          durationMinutes: input.durationMinutes,
        },
      });

      // Replace the question set. Snapshot existing ids so we know which to
      // delete cleanly (orphans not present in the incoming payload).
      const existingIds = (
        await tx.examQuestion.findMany({
          where: { examId: exam.id },
          select: { id: true },
        })
      ).map((q) => q.id);
      const incomingIds = new Set(
        input.questions.filter((q) => q.id).map((q) => q.id as string),
      );
      const toDelete = existingIds.filter((id) => !incomingIds.has(id));
      if (toDelete.length > 0) {
        await tx.examQuestion.deleteMany({ where: { id: { in: toDelete } } });
      }

      // Upsert each remaining question by id; new ones (no id) get created.
      for (let i = 0; i < input.questions.length; i++) {
        const q = input.questions[i];
        const data = {
          examId: exam.id,
          position: i,
          type: q.type,
          prompt: q.prompt,
          points: q.points,
          choices: q.type === "MC" ? (q.choices as Prisma.InputJsonValue) : ([] as Prisma.InputJsonValue),
          correctIndex: q.type === "MC" ? q.correctIndex : null,
          acceptedAnswers:
            q.type === "FILL"
              ? // Normalise FILL answers at write time so the runtime auto-grade
                // can do a straight equality check on trim+lowercase.
                (q.acceptedAnswers
                  .map((a) => a.trim())
                  .filter(Boolean) as Prisma.InputJsonValue)
              : ([] as Prisma.InputJsonValue),
        };
        if (q.id) {
          await tx.examQuestion.update({ where: { id: q.id }, data });
        } else {
          await tx.examQuestion.create({ data });
        }
      }

      await logChange({
        tx,
        action: "UPDATE",
        entityType: "Exam",
        entityId: exam.id,
        actorUserId: user.id,
        changes: {
          moduleId: mod.id,
          title: input.title,
          passingScore: input.passingScore,
          durationMinutes: input.durationMinutes,
          questionCount: input.questions.length,
        } as Prisma.InputJsonValue,
      });

      return exam;
    });

    revalidatePath("/admin/exams");
    revalidatePath(`/admin/exams/${input.moduleId}`);
    return { ok: true, examId: result.id };
  } catch (err) {
    console.error("saveExamAction failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// =========================================================================
// P3 — teacher schedules an exam session for their batch.
// =========================================================================

export type ScheduleExamSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function scheduleExamSessionAction(
  raw: ScheduleExamSessionInput,
): Promise<ScheduleExamSessionResult> {
  const user = await requireRole(["ADMIN", "STAFF", "TEACHER"]);

  const parsed = scheduleExamSessionSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ||= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    select: { id: true, trainerId: true, courseId: true },
  });
  if (!batch) return { ok: false, error: "Batch not found." };
  // Teachers can only schedule on their own batches.
  if (user.role === "TEACHER" && batch.trainerId !== user.id) {
    return { ok: false, error: "You don't own this batch." };
  }

  // Resolve or create the Exam definition for this module.
  const exam = await getOrCreateExamForModule(input.moduleId);
  if (!exam) return { ok: false, error: "Module not found." };
  if (exam.module.courseId !== batch.courseId) {
    return { ok: false, error: "Module doesn't belong to this batch's course." };
  }

  // Avoid duplicate EXAM session for the same batch+module — re-schedule by
  // updating the existing one instead of stacking new rows.
  const existing = await prisma.batchSession.findFirst({
    where: { batchId: batch.id, moduleId: input.moduleId, kind: "EXAM" },
    select: { id: true, sequenceInModule: true },
  });

  // Compute end time from duration so the schedule renders the time window.
  const [startH, startM] = input.startTime.split(":").map(Number);
  const totalMin = startH * 60 + startM + input.durationMinutes;
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  const hours = Math.ceil(input.durationMinutes / 60);

  try {
    let sessionId: string;
    if (existing) {
      await prisma.batchSession.update({
        where: { id: existing.id },
        data: {
          scheduledDate: new Date(`${input.scheduledDate}T00:00:00.000Z`),
          startTime: input.startTime,
          endTime,
          hours,
          examId: exam.id,
        },
      });
      sessionId = existing.id;
    } else {
      // sequenceInModule is part of the uniqueness key; pick the next free.
      const maxSeq = await prisma.batchSession.aggregate({
        where: { batchId: batch.id, moduleId: input.moduleId },
        _max: { sequenceInModule: true },
      });
      const next = (maxSeq._max.sequenceInModule ?? 0) + 1;
      const created = await prisma.batchSession.create({
        data: {
          batchId: batch.id,
          moduleId: input.moduleId,
          sequenceInModule: next,
          scheduledDate: new Date(`${input.scheduledDate}T00:00:00.000Z`),
          startTime: input.startTime,
          endTime,
          hours,
          kind: "EXAM",
          examId: exam.id,
        },
      });
      sessionId = created.id;
    }

    await logChange({
      action: "UPDATE",
      entityType: "BatchSession",
      entityId: sessionId,
      actorUserId: user.id,
      changes: {
        kind: "EXAM",
        moduleId: input.moduleId,
        scheduledDate: input.scheduledDate,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
      } as Prisma.InputJsonValue,
    });

    revalidatePath(`/admin/batches/${batch.id}`);
    revalidatePath(`/teacher/batches/${batch.id}`);
    return { ok: true, sessionId };
  } catch (err) {
    console.error("scheduleExamSessionAction failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// =========================================================================
// P5 — teacher / admin grades the OPEN answers on a submission.
// =========================================================================

export type GradeExamSubmissionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function gradeExamSubmissionAction(
  raw: GradeExamSubmissionInput,
): Promise<GradeExamSubmissionResult> {
  const user = await requireRole(["ADMIN", "STAFF", "TEACHER"]);

  const parsed = gradeExamSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const submission = await prisma.examSubmission.findUnique({
    where: { id: input.submissionId },
    include: {
      answers: {
        include: { question: { select: { id: true, type: true, points: true } } },
      },
      batchSession: { select: { batchId: true, batch: { select: { trainerId: true } } } },
    },
  });
  if (!submission) return { ok: false, error: "Submission not found." };
  if (
    user.role === "TEACHER" &&
    submission.batchSession.batch.trainerId !== user.id
  ) {
    return { ok: false, error: "You don't own this batch." };
  }
  if (submission.status === "IN_PROGRESS") {
    return { ok: false, error: "Submission hasn't been submitted yet." };
  }

  // Clamp each grade to [0, question.points] so a typo can't inflate scores.
  const answerById = new Map(submission.answers.map((a) => [a.id, a]));
  for (const g of input.grades) {
    const a = answerById.get(g.answerId);
    if (!a) return { ok: false, error: "Unknown answer in payload." };
    if (a.question.type !== "OPEN") {
      return {
        ok: false,
        error: "Only OPEN answers are teacher-graded.",
      };
    }
    if (g.pointsAwarded > a.question.points) {
      return {
        ok: false,
        error: `Question max is ${a.question.points} points.`,
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const g of input.grades) {
        await tx.examAnswer.update({
          where: { id: g.answerId },
          data: { pointsAwarded: g.pointsAwarded },
        });
      }
      // Recompute the teacherScore as the sum of OPEN pointsAwarded across all
      // OPEN answers on this submission (using the in-memory snapshot for
      // anything not in the grades payload — that keeps prior partial grading
      // intact across multiple save passes).
      const updatedOpenSum = submission.answers
        .filter((a) => a.question.type === "OPEN")
        .reduce((acc, a) => {
          const override = input.grades.find((g) => g.answerId === a.id);
          const value = override?.pointsAwarded ?? a.pointsAwarded ?? 0;
          return acc + value;
        }, 0);

      await tx.examSubmission.update({
        where: { id: input.submissionId },
        data: {
          teacherScore: updatedOpenSum,
          status: "GRADED",
          gradedById: user.id,
          gradedAt: new Date(),
        },
      });
      await logChange({
        tx,
        action: "UPDATE",
        entityType: "ExamSubmission",
        entityId: input.submissionId,
        actorUserId: user.id,
        studentId: submission.studentId,
        changes: {
          teacherScore: updatedOpenSum,
          status: "GRADED",
        } as Prisma.InputJsonValue,
      });
    });

    revalidatePath(
      `/teacher/exams/${input.submissionId}/grade`,
    );
    return { ok: true };
  } catch (err) {
    console.error("gradeExamSubmissionAction failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
