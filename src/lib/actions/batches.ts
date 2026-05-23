"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import {
  batchCreateSchema,
  batchUpdateSchema,
  type BatchCreateInput,
  type BatchUpdateInput,
} from "@/lib/validators/batch";
import { generateSessions } from "@/lib/cronograma/generate";

export type CreateBatchResult =
  | { ok: true; id: string; code: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createBatchAction(
  raw: BatchCreateInput,
): Promise<CreateBatchResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  const parsed = batchCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ||= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  // Load the course + its 6 modules so we can pin moduleId on each session row.
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    include: { modules: { orderBy: { number: "asc" } } },
  });
  if (!course) {
    return { ok: false, error: "Course not found.", fieldErrors: { courseId: "Course not found." } };
  }

  // Optional trainer must exist and have role=TEACHER.
  if (input.trainerId) {
    const trainer = await prisma.user.findUnique({
      where: { id: input.trainerId },
      select: { role: true, isActive: true },
    });
    if (!trainer || !trainer.isActive || trainer.role !== "TEACHER") {
      return {
        ok: false,
        error: "Selected trainer is not a teacher.",
        fieldErrors: { trainerId: "Selected trainer is not a teacher." },
      };
    }
  }

  // Generate 36 session specs from the start date.
  const specs = generateSessions({
    startDate: input.startDate,
    startTime: input.startTime,
    durationHours: input.durationHours,
    moduleCount: course.modules.length,
  });

  // Map module number → module id.
  const moduleByNumber = new Map(course.modules.map((m) => [m.number, m]));

  try {
    const created = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          code: input.code,
          courseId: input.courseId,
          trainerId: input.trainerId,
          startDate: new Date(`${input.startDate}T00:00:00.000Z`),
          startTime: input.startTime,
          durationHours: input.durationHours,
          capacity: input.capacity,
          status: "UPCOMING",
        },
      });

      await tx.batchSession.createMany({
        data: specs.map((s) => {
          const mod = moduleByNumber.get(s.moduleNumber);
          if (!mod) throw new Error(`No module #${s.moduleNumber}`);
          return {
            batchId: batch.id,
            moduleId: mod.id,
            sequenceInModule: s.sequenceInModule,
            scheduledDate: s.scheduledDate,
            startTime: s.startTime,
            endTime: s.endTime,
            hours: s.hours,
            kind: s.kind,
          };
        }),
      });

      await logChange({
        tx,
        action: "CREATE",
        entityType: "Batch",
        entityId: batch.id,
        actorUserId: user.id,
        changes: {
          code: { from: null, to: batch.code },
          courseId: { from: null, to: batch.courseId },
          startDate: { from: null, to: input.startDate },
          startTime: { from: null, to: batch.startTime },
          durationHours: { from: null, to: batch.durationHours },
          trainerId: { from: null, to: batch.trainerId },
          capacity: { from: null, to: batch.capacity },
          sessionsGenerated: specs.length,
        },
      });

      return batch;
    });

    revalidatePath("/admin/batches");
    return { ok: true, id: created.id, code: created.code };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        ok: false,
        error: "A batch with that code already exists.",
        fieldErrors: { code: "Already in use." },
      };
    }
    console.error("createBatchAction failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const assignTrainerSchema = z.object({
  batchId: z.string().uuid("Invalid batch."),
  trainerId: z.string().uuid("Invalid trainer.").nullable(),
});

export type AssignTrainerResult =
  | { ok: true; trainerId: string | null }
  | { ok: false; error: string };

export async function assignBatchTrainerAction(
  raw: { batchId: string; trainerId: string | null },
): Promise<AssignTrainerResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  const parsed = assignTrainerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { batchId, trainerId } = parsed.data;

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true, trainerId: true },
  });
  if (!batch) return { ok: false, error: "Batch not found." };

  if (trainerId) {
    const trainer = await prisma.user.findUnique({
      where: { id: trainerId },
      select: { role: true, isActive: true },
    });
    if (!trainer || !trainer.isActive || trainer.role !== "TEACHER") {
      return { ok: false, error: "Selected trainer is not a teacher." };
    }
  }

  if (batch.trainerId === trainerId) {
    return { ok: true, trainerId };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.batch.update({
        where: { id: batchId },
        data: { trainerId },
      });
      await logChange({
        tx,
        action: "UPDATE",
        entityType: "Batch",
        entityId: batchId,
        actorUserId: user.id,
        changes: {
          trainerId: { from: batch.trainerId, to: trainerId },
        },
      });
    });

    revalidatePath(`/admin/batches/${batchId}`);
    revalidatePath("/admin/batches");
    return { ok: true, trainerId };
  } catch (err) {
    console.error("assignBatchTrainerAction failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export type UpdateBatchResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Edit existing batch metadata. Schedule date/time changes DO NOT cascade to
// already-generated sessions — those are mutable per-session via the
// teacher/admin attendance flow. Reflecting that here keeps the action
// scope narrow and avoids surprise mass-edits.
export async function updateBatchAction(
  raw: BatchUpdateInput,
): Promise<UpdateBatchResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  const parsed = batchUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ||= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const existing = await prisma.batch.findUnique({
    where: { id: input.id },
    select: {
      code: true,
      startDate: true,
      startTime: true,
      durationHours: true,
      capacity: true,
      status: true,
    },
  });
  if (!existing) return { ok: false, error: "Batch not found." };

  const nextStartDate = new Date(`${input.startDate}T00:00:00.000Z`);
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (existing.code !== input.code) changes.code = { from: existing.code, to: input.code };
  if (existing.startDate.toISOString().slice(0, 10) !== input.startDate)
    changes.startDate = { from: existing.startDate.toISOString().slice(0, 10), to: input.startDate };
  if (existing.startTime !== input.startTime)
    changes.startTime = { from: existing.startTime, to: input.startTime };
  if (existing.durationHours !== input.durationHours)
    changes.durationHours = { from: existing.durationHours, to: input.durationHours };
  if (existing.capacity !== input.capacity)
    changes.capacity = { from: existing.capacity, to: input.capacity };
  if (existing.status !== input.status)
    changes.status = { from: existing.status, to: input.status };

  if (Object.keys(changes).length === 0) {
    return { ok: true, id: input.id };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.batch.update({
        where: { id: input.id },
        data: {
          code: input.code,
          startDate: nextStartDate,
          startTime: input.startTime,
          durationHours: input.durationHours,
          capacity: input.capacity,
          status: input.status,
        },
      });
      await logChange({
        tx,
        action: "UPDATE",
        entityType: "Batch",
        entityId: input.id,
        actorUserId: user.id,
        changes: changes as Prisma.InputJsonValue,
      });
    });

    revalidatePath(`/admin/batches/${input.id}`);
    revalidatePath("/admin/batches");
    return { ok: true, id: input.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        ok: false,
        error: "A batch with that code already exists.",
        fieldErrors: { code: "Already in use." },
      };
    }
    console.error("updateBatchAction failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
