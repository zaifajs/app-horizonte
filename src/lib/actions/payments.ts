"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";

// One PaymentReceipt = one money-received event. Multiple receipts can sit
// under the same Payment (the installment "obligation").
//
// When the sum of receipts >= expectedAmountCents the Payment is considered
// fully paid; paidAt is set and (for installment 1) the enrollment auto-
// activates from PENDING → ACTIVE.

const addReceiptSchema = z.object({
  paymentId: z.string().uuid(),
  /** Amount in EUR (e.g. "100", "100.50"). Stored as cents internally. */
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 100 or 100.50."),
  method: z.enum(["BANK", "CASH"]),
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  notes: z.string().max(2000).optional().nullable(),
});

export type AddReceiptInput = z.input<typeof addReceiptSchema>;
export type AddReceiptResult =
  | { ok: true; fullyPaid: boolean }
  | { ok: false; error: string };

export async function addPaymentReceiptAction(
  raw: AddReceiptInput,
): Promise<AddReceiptResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  const parsed = addReceiptSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const amountCents = Math.round(parseFloat(input.amount) * 100);
  if (amountCents <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }

  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      installment: true,
      expectedAmountCents: true,
      paidAmountCents: true,
      enrollmentId: true,
      enrollment: {
        select: { id: true, studentId: true, batchId: true, status: true },
      },
    },
  });
  if (!payment) return { ok: false, error: "Payment not found." };

  const result = await prisma.$transaction(async (tx) => {
    const receipt = await tx.paymentReceipt.create({
      data: {
        paymentId: payment.id,
        amountCents,
        method: input.method as PaymentMethod,
        paidAt: new Date(`${input.paidAt}T00:00:00Z`),
        collectedById: user.id,
        notes: input.notes ?? null,
      },
    });

    const newPaidTotal = payment.paidAmountCents + amountCents;
    const fullyPaid = newPaidTotal >= payment.expectedAmountCents;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        paidAmountCents: newPaidTotal,
        paidAt: fullyPaid ? new Date() : null,
      },
    });

    await logChange({
      tx,
      action: "CREATE",
      entityType: "PaymentReceipt",
      entityId: receipt.id,
      actorUserId: user.id,
      studentId: payment.enrollment.studentId,
      changes: {
        paymentId: payment.id,
        installment: payment.installment,
        amountCents,
        method: input.method,
        paidAt: input.paidAt,
        runningTotalCents: newPaidTotal,
        fullyPaid,
      } as Prisma.InputJsonValue,
    });

    // Auto-activate the enrollment when installment 1 is fully paid.
    let activated = false;
    if (
      fullyPaid &&
      payment.installment === 1 &&
      payment.enrollment.status === "PENDING"
    ) {
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
          reason: "Installment 1 fully paid.",
        } as Prisma.InputJsonValue,
      });
      activated = true;
    }

    return { fullyPaid, activated };
  });

  revalidatePath(`/admin/students/${payment.enrollment.studentId}`);
  if (payment.enrollment.batchId) {
    revalidatePath(`/admin/batches/${payment.enrollment.batchId}`);
  }
  return { ok: true, fullyPaid: result.fullyPaid };
}

// Optional: delete a receipt (e.g. correction). Recomputes paidAmountCents.
const deleteReceiptSchema = z.object({ receiptId: z.string().uuid() });

export async function deletePaymentReceiptAction(
  raw: z.input<typeof deleteReceiptSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(["ADMIN", "STAFF"]);
  const parsed = deleteReceiptSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const receipt = await prisma.paymentReceipt.findUnique({
    where: { id: parsed.data.receiptId },
    select: {
      id: true,
      amountCents: true,
      paymentId: true,
      payment: {
        select: {
          enrollmentId: true,
          enrollment: { select: { studentId: true, batchId: true } },
        },
      },
    },
  });
  if (!receipt) return { ok: false, error: "Receipt not found." };

  await prisma.$transaction(async (tx) => {
    await tx.paymentReceipt.delete({ where: { id: receipt.id } });

    const sum = await tx.paymentReceipt.aggregate({
      where: { paymentId: receipt.paymentId },
      _sum: { amountCents: true },
    });
    const total = sum._sum.amountCents ?? 0;

    const payment = await tx.payment.update({
      where: { id: receipt.paymentId },
      data: {
        paidAmountCents: total,
        paidAt: null, // re-evaluated below
      },
      select: { expectedAmountCents: true },
    });
    if (total >= payment.expectedAmountCents) {
      await tx.payment.update({
        where: { id: receipt.paymentId },
        data: { paidAt: new Date() },
      });
    }

    await logChange({
      tx,
      action: "DELETE",
      entityType: "PaymentReceipt",
      entityId: receipt.id,
      actorUserId: user.id,
      studentId: receipt.payment.enrollment.studentId,
      changes: { amountCents: receipt.amountCents, runningTotalCents: total },
    });
  });

  revalidatePath(`/admin/students/${receipt.payment.enrollment.studentId}`);
  if (receipt.payment.enrollment.batchId) {
    revalidatePath(`/admin/batches/${receipt.payment.enrollment.batchId}`);
  }
  return { ok: true };
}
