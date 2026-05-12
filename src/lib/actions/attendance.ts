"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AttendanceState, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";

const ATTENDANCE_STATES = [
  "PRESENT",
  "LATE",
  "LEFT_EARLY",
  "EXCUSED_ABSENCE",
  "UNEXCUSED_ABSENCE",
] as const;

const schema = z.object({
  sessionId: z.string().uuid(),
  notes: z.string().max(2000).nullable().optional(),
  /** Mark all students; missing students = no record */
  entries: z.array(
    z.object({
      enrollmentId: z.string().uuid(),
      state: z.enum(ATTENDANCE_STATES),
      notes: z.string().max(2000).nullable().optional(),
    }),
  ),
});

export type MarkAttendanceInput = z.input<typeof schema>;
export type MarkAttendanceResult =
  | { ok: true; marked: number }
  | { ok: false; error: string };

export async function markAttendanceAction(
  raw: MarkAttendanceInput,
): Promise<MarkAttendanceResult> {
  const user = await requireRole(["TEACHER", "ADMIN", "STAFF"]);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  // Make sure the teacher owns this session's batch (or is admin/staff).
  const session = await prisma.batchSession.findUnique({
    where: { id: input.sessionId },
    include: { batch: { select: { id: true, trainerId: true } } },
  });
  if (!session) return { ok: false, error: "Session not found." };
  if (user.role === "TEACHER" && session.batch.trainerId !== user.id) {
    return { ok: false, error: "You are not the trainer for this batch." };
  }

  await prisma.$transaction(async (tx) => {
    for (const e of input.entries) {
      await tx.attendance.upsert({
        where: {
          sessionId_enrollmentId: {
            sessionId: input.sessionId,
            enrollmentId: e.enrollmentId,
          },
        },
        create: {
          sessionId: input.sessionId,
          enrollmentId: e.enrollmentId,
          state: e.state as AttendanceState,
          notes: e.notes ?? null,
          markedById: user.id,
        },
        update: {
          state: e.state as AttendanceState,
          notes: e.notes ?? null,
          markedById: user.id,
          markedAt: new Date(),
        },
      });
    }

    // Mark the session as HELD.
    if (session.status !== "HELD") {
      await tx.batchSession.update({
        where: { id: input.sessionId },
        data: { status: "HELD", notes: input.notes ?? session.notes },
      });
    } else if (input.notes != null && input.notes !== session.notes) {
      await tx.batchSession.update({
        where: { id: input.sessionId },
        data: { notes: input.notes },
      });
    }

    await logChange({
      tx,
      action: "UPDATE",
      entityType: "BatchSession",
      entityId: input.sessionId,
      actorUserId: user.id,
      changes: {
        action: "attendance marked",
        entriesMarked: input.entries.length,
        sessionStatus: { from: session.status, to: "HELD" },
      } as Prisma.InputJsonValue,
    });
  });

  revalidatePath(`/teacher/sessions/${input.sessionId}`);
  revalidatePath(`/teacher/batches/${session.batch.id}`);
  revalidatePath(`/admin/batches/${session.batch.id}`);
  return { ok: true, marked: input.entries.length };
}
