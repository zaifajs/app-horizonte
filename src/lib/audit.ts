// Single helper for writing AuditLog rows. Every mutation goes through here
// so it's impossible to "forget" to audit a change.
//
// Usage:
//   await logChange({
//     action: "CREATE",
//     entityType: "Batch",
//     entityId: batch.id,
//     actorUserId: user.id,
//     changes: { code: { from: null, to: "J5" } },
//   })

import { prisma } from "@/lib/db";
import type { AuditAction, Prisma } from "@prisma/client";

export type LogChangeInput = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  /** Denormalized: when the entity is student-scoped, set this so the student
   *  detail page can show a single chronological activity stream. */
  studentId?: string | null;
  /** Diff payload — typically { field: { from, to } } for updates,
   *  the created/deleted row's salient fields for create/delete. */
  changes?: Prisma.InputJsonValue;
  /** Optional Prisma transaction client; otherwise uses the default. */
  tx?: Prisma.TransactionClient;
};

export async function logChange(input: LogChangeInput) {
  const client = input.tx ?? prisma;
  await client.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actorUserId ?? null,
      studentId: input.studentId ?? null,
      changes: input.changes ?? undefined,
    },
  });
}
