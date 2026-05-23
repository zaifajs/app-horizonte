"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deletePaymentAction } from "@/lib/actions/payments";
import { QuickPay } from "../quick-pay";

type Method = "BANK" | "CASH";

type Payment = {
  id: string;
  amountCents: number;
  paidAt: Date;
  method: Method;
  notes: string | null;
  hasProof: boolean;
};

export function EnrollmentPayments({
  enrollmentId,
  feeCents,
  payments,
  studentId,
  studentName,
  studentEmail,
  batchCode,
  urgencyTone,
}: {
  enrollmentId: string;
  feeCents: number;
  payments: Payment[];
  studentId: string;
  studentName: string;
  studentEmail?: string;
  batchCode?: string;
  urgencyTone?: "danger" | "warning" | "due" | "neutral";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const totalPaidCents = payments.reduce((a, p) => a + p.amountCents, 0);
  const feeEur = feeCents / 100;
  const paidEur = totalPaidCents / 100;
  const leftCents = Math.max(0, feeCents - totalPaidCents);
  const leftEur = leftCents / 100;
  const fullyPaid = totalPaidCents >= feeCents;
  const pct = Math.min(100, Math.round((totalPaidCents / feeCents) * 100));

  function remove() {
    if (!confirmDelete) return;
    const paymentId = confirmDelete;
    startTransition(async () => {
      const result = await deletePaymentAction({ paymentId });
      if (!result.ok && result.error) setError(result.error);
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Progress bar / summary */}
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <div>
            <span className="font-medium">€{paidEur.toFixed(2)}</span>
            <span className="text-muted-foreground">
              {" "}
              paid of €{feeEur.toFixed(2)}
            </span>
          </div>
          <div className="text-xs">
            {fullyPaid ? (
              <span className="chip chip-success">Fully paid</span>
            ) : (
              <span className="text-[var(--hz-warning)]">
                €{leftEur.toFixed(2)} left to pay
              </span>
            )}
          </div>
        </div>
        <div className="pbar">
          <span
            style={{
              width: `${pct}%`,
              background: fullyPaid ? "var(--hz-success)" : "var(--hz-warning)",
            }}
          />
        </div>
      </div>

      {/* List of payments */}
      {payments.length > 0 ? (
        <ul className="space-y-1.5">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded border bg-card px-3 py-2 text-sm"
            >
              <div>
                <div>
                  <span className="font-medium">€{(p.amountCents / 100).toFixed(2)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {p.method.toLowerCase()} · {format(p.paidAt, "dd MMM yyyy")}
                  </span>
                </div>
                {p.notes ? (
                  <div className="text-xs text-muted-foreground mt-0.5">{p.notes}</div>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {p.hasProof ? (
                  <a
                    href={`/api/payments/${p.id}/proof`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-muted-foreground hover:text-foreground"
                  >
                    View proof
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setConfirmDelete(p.id)}
                  className="text-muted-foreground hover:text-destructive underline"
                  disabled={pending}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete this payment?"
        description="Activation state will not auto-revert. If the enrollment was activated by this payment, you may need to deactivate it manually."
        confirmLabel="Delete payment"
        destructive
        pending={pending}
        onConfirm={remove}
      />

      {/* Use the same QuickPay modal as the students list. Custom trigger
          so the button shows "Record first/another payment" instead of an
          icon. */}
      <QuickPay
        enrollmentId={enrollmentId}
        studentId={studentId}
        studentName={studentName}
        remainingCents={leftCents}
        feeCents={feeCents}
        paidCents={totalPaidCents}
        studentEmail={studentEmail}
        batchCode={batchCode}
        urgencyTone={urgencyTone}
        trigger={(open) => (
          <button
            type="button"
            onClick={(e) => open(e)}
            className={fullyPaid ? "btn-ghost" : "btn-primary"}
          >
            {payments.length === 0
              ? "Record first payment"
              : "Record another payment"}
          </button>
        )}
      />

      {error ? (
        <p className="text-sm" style={{ color: "var(--hz-danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
