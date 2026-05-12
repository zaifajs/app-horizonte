"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";

// One Payment row = one money-received event. There's no fixed installment
// structure: staff records as many or as few payments as the student arranges,
// in any amount. The total target is `Course.feeCents` (€450 for PLA).
//
// The FIRST payment recorded against an Enrollment auto-activates it from
// PENDING → ACTIVE. Activation is one-way: deleting payments later does NOT
// revert it (avoids surprise UX).

const addPaymentSchema = z.object({
  enrollmentId: z.string().uuid(),
  /** Amount in EUR, e.g. "100" or "100.50". Stored as cents internally. */
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 100 or 100.50."),
  method: z.enum(["BANK", "CASH"]),
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  notes: z.string().max(2000).optional().nullable(),
});

export type AddPaymentInput = z.input<typeof addPaymentSchema>;
export type AddPaymentResult =
  | { ok: true; activated: boolean }
  | { ok: false; error: string };

export async function addPaymentAction(
  raw: AddPaymentInput,
): Promise<AddPaymentResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  const parsed = addPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const amountCents = Math.round(parseFloat(input.amount) * 100);
  if (amountCents <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: input.enrollmentId },
    select: { id: true, status: true, studentId: true, batchId: true },
  });
  if (!enrollment) return { ok: false, error: "Enrollment not found." };

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        enrollmentId: enrollment.id,
        amountCents,
        method: input.method as PaymentMethod,
        paidAt: new Date(`${input.paidAt}T00:00:00Z`),
        collectedById: user.id,
        notes: input.notes ?? null,
      },
    });

    await logChange({
      tx,
      action: "CREATE",
      entityType: "Payment",
      entityId: payment.id,
      actorUserId: user.id,
      studentId: enrollment.studentId,
      changes: {
        enrollmentId: enrollment.id,
        amountCents,
        method: input.method,
        paidAt: input.paidAt,
      } as Prisma.InputJsonValue,
    });

    let activated = false;
    if (enrollment.status === "PENDING") {
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "ACTIVE" },
      });
      await logChange({
        tx,
        action: "UPDATE",
        entityType: "Enrollment",
        entityId: enrollment.id,
        actorUserId: user.id,
        studentId: enrollment.studentId,
        changes: {
          status: { from: "PENDING", to: "ACTIVE" },
          reason: "First payment recorded.",
        } as Prisma.InputJsonValue,
      });
      activated = true;
    }

    return { activated };
  });

  revalidatePath(`/admin/students/${enrollment.studentId}`);
  if (enrollment.batchId) {
    revalidatePath(`/admin/batches/${enrollment.batchId}`);
  }
  return { ok: true, activated: result.activated };
}

const deletePaymentSchema = z.object({ paymentId: z.string().uuid() });

export async function deletePaymentAction(
  raw: z.input<typeof deletePaymentSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(["ADMIN", "STAFF"]);
  const parsed = deletePaymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const payment = await prisma.payment.findUnique({
    where: { id: parsed.data.paymentId },
    select: {
      id: true,
      amountCents: true,
      method: true,
      enrollmentId: true,
      enrollment: { select: { studentId: true, batchId: true } },
    },
  });
  if (!payment) return { ok: false, error: "Payment not found." };

  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: payment.id } });
    await logChange({
      tx,
      action: "DELETE",
      entityType: "Payment",
      entityId: payment.id,
      actorUserId: user.id,
      studentId: payment.enrollment.studentId,
      changes: {
        amountCents: payment.amountCents,
        method: payment.method,
      },
    });
  });

  revalidatePath(`/admin/students/${payment.enrollment.studentId}`);
  if (payment.enrollment.batchId) {
    revalidatePath(`/admin/batches/${payment.enrollment.batchId}`);
  }
  return { ok: true };
}
