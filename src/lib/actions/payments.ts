"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";

// Minimal mark-paid action. Phase 4 adds: proof upload, custom amount,
// partial payments, multiple methods of editing.

const schema = z.object({
  paymentId: z.string().uuid(),
  method: z.enum(["BANK", "CASH"]),
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  notes: z.string().max(2000).optional().nullable(),
});

export type MarkPaidInput = z.input<typeof schema>;
export type MarkPaidResult =
  | { ok: true }
  | { ok: false; error: string };

export async function markPaymentPaidAction(
  raw: MarkPaidInput,
): Promise<MarkPaidResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      paidAt: true,
      method: true,
      installment: true,
      amountCents: true,
      enrollmentId: true,
      enrollment: {
        select: {
          id: true,
          studentId: true,
          batchId: true,
          status: true,
        },
      },
    },
  });
  if (!payment) return { ok: false, error: "Payment not found." };
  if (payment.paidAt) {
    return { ok: false, error: "Payment already marked as paid." };
  }

  const paidAt = new Date(`${input.paidAt}T00:00:00Z`);
  const method = input.method as PaymentMethod;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: input.paymentId },
      data: {
        paidAt,
        method,
        collectedById: user.id,
        notes: input.notes ?? null,
      },
    });

    await logChange({
      tx,
      action: "UPDATE",
      entityType: "Payment",
      entityId: input.paymentId,
      actorUserId: user.id,
      studentId: payment.enrollment.studentId,
      changes: {
        paidAt: { from: null, to: paidAt.toISOString().slice(0, 10) },
        method: { from: null, to: method },
        installment: payment.installment,
        amountCents: payment.amountCents,
      } as Prisma.InputJsonValue,
    });

    // Auto-activate enrollment when installment 1 is paid.
    if (payment.installment === 1 && payment.enrollment.status === "PENDING") {
      await tx.enrollment.update({
        where: { id: payment.enrollment.id },
        data: { status: "ACTIVE" },
      });
      await logChange({
        tx,
        action: "UPDATE",
        entityType: "Enrollment",
        entityId: payment.enrollment.id,
        actorUserId: user.id,
        studentId: payment.enrollment.studentId,
        changes: {
          status: { from: "PENDING", to: "ACTIVE" },
          reason: "Installment 1 marked paid.",
        } as Prisma.InputJsonValue,
      });
    }
  });

  revalidatePath(`/admin/students/${payment.enrollment.studentId}`);
  if (payment.enrollment.batchId) {
    revalidatePath(`/admin/batches/${payment.enrollment.batchId}`);
  }
  return { ok: true };
}
