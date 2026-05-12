"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma, SessionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";

const updateSchema = z.object({
  sessionId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  status: z.enum(["SCHEDULED", "HELD", "CANCELLED", "RESCHEDULED"]),
  notes: z.string().max(2000).nullable().optional(),
});

export type UpdateSessionInput = z.input<typeof updateSchema>;

export type UpdateSessionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateSessionAction(
  raw: UpdateSessionInput,
): Promise<UpdateSessionResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const before = await prisma.batchSession.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      batchId: true,
      scheduledDate: true,
      startTime: true,
      endTime: true,
      status: true,
      notes: true,
      kind: true,
    },
  });
  if (!before) return { ok: false, error: "Session not found." };

  const newDate = new Date(`${input.scheduledDate}T00:00:00.000Z`);
  const newStatus = input.status as SessionStatus;
  const newStart = before.kind === "AUTONOMOUS" ? null : input.startTime ?? null;
  const newEnd = before.kind === "AUTONOMOUS" ? null : input.endTime ?? null;

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (before.scheduledDate.toISOString().slice(0, 10) !== input.scheduledDate) {
    changes.scheduledDate = {
      from: before.scheduledDate.toISOString().slice(0, 10),
      to: input.scheduledDate,
    };
  }
  if (before.startTime !== newStart) {
    changes.startTime = { from: before.startTime, to: newStart };
  }
  if (before.endTime !== newEnd) {
    changes.endTime = { from: before.endTime, to: newEnd };
  }
  if (before.status !== newStatus) {
    changes.status = { from: before.status, to: newStatus };
  }
  const newNotes = input.notes ?? null;
  if ((before.notes ?? null) !== newNotes) {
    changes.notes = { from: before.notes, to: newNotes };
  }

  if (Object.keys(changes).length === 0) {
    return { ok: true };
  }

  if (newStatus === "CANCELLED" && !newNotes) {
    return {
      ok: false,
      error: "Cancellation requires a reason in notes.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.batchSession.update({
      where: { id: input.sessionId },
      data: {
        scheduledDate: newDate,
        startTime: newStart,
        endTime: newEnd,
        status: newStatus,
        notes: newNotes,
      },
    });
    await logChange({
      tx,
      action: "UPDATE",
      entityType: "BatchSession",
      entityId: input.sessionId,
      actorUserId: user.id,
      changes: changes as Prisma.InputJsonValue,
    });
  });

  revalidatePath(`/admin/batches/${before.batchId}`);
  return { ok: true };
}
