"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addPaymentReceiptAction,
  deletePaymentReceiptAction,
} from "@/lib/actions/payments";

type Method = "BANK" | "CASH";

type Receipt = {
  id: string;
  amountCents: number;
  paidAt: Date;
  method: Method;
  notes: string | null;
};

export function PaymentRow({
  payment,
}: {
  payment: {
    id: string;
    installment: number;
    expectedAmountCents: number;
    paidAmountCents: number;
    dueDate: Date;
    paidAt: Date | null;
    receipts: Receipt[];
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const expectedEur = payment.expectedAmountCents / 100;
  const paidEur = payment.paidAmountCents / 100;
  const outstandingEur = Math.max(0, expectedEur - paidEur);
  const isFullyPaid = !!payment.paidAt;
  const isPartial = !isFullyPaid && paidEur > 0;

  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState(outstandingEur.toFixed(2));
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<Method>("BANK");
  const [notes, setNotes] = useState("");

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await addPaymentReceiptAction({
        paymentId: payment.id,
        amount,
        method,
        paidAt,
        notes: notes.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotes("");
      setAmount("");
      router.refresh();
    });
  }

  function removeReceipt(receiptId: string) {
    if (!confirm("Delete this receipt? Sum and activation state will recompute.")) return;
    startTransition(async () => {
      const result = await deletePaymentReceiptAction({ receiptId });
      if (!result.ok && result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="rounded border bg-zinc-50/60 p-3 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-medium">
            Installment {payment.installment} · €{expectedEur.toFixed(2)}
          </div>
          <div className="text-muted-foreground mt-0.5">
            Due {format(payment.dueDate, "dd MMM yyyy")}
          </div>
        </div>
        <PaymentStatusBadge
          fullyPaid={isFullyPaid}
          partial={isPartial}
          paid={paidEur}
          expected={expectedEur}
        />
      </div>

      {payment.receipts.length > 0 ? (
        <div className="space-y-1">
          {payment.receipts.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 rounded bg-white border px-2 py-1"
            >
              <div>
                <span className="font-medium">€{(r.amountCents / 100).toFixed(2)}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {r.method.toLowerCase()} · {format(r.paidAt, "dd MMM yyyy")}
                </span>
                {r.notes ? (
                  <div className="text-muted-foreground text-[10px] mt-0.5">{r.notes}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeReceipt(r.id)}
                className="text-[10px] text-muted-foreground hover:text-destructive underline"
                disabled={pending}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger>
          <Button size="sm" variant={isFullyPaid ? "outline" : "default"}>
            {isFullyPaid
              ? "Add another receipt"
              : payment.receipts.length === 0
                ? "Mark paid"
                : `Add payment (€${outstandingEur.toFixed(2)} left)`}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Record payment — installment {payment.installment}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Expected €{expectedEur.toFixed(2)} · already received €{paidEur.toFixed(2)} ·{" "}
              {isFullyPaid ? "fully paid" : `€${outstandingEur.toFixed(2)} outstanding`}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`amount-${payment.id}`}>Amount (€)</Label>
                <Input
                  id={`amount-${payment.id}`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`paidAt-${payment.id}`}>Paid on</Label>
                <Input
                  id={`paidAt-${payment.id}`}
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`method-${payment.id}`}>Method</Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v as Method)}>
                <SelectTrigger id={`method-${payment.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">Bank transfer</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`notes-${payment.id}`}>Notes</Label>
              <Textarea
                id={`notes-${payment.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Bank ref, partial-pay context, etc."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Proof PDF upload comes in Phase 4. For now, partial payments are
              tracked here and the enrollment activates when installment 1 is
              fully paid.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Close
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentStatusBadge({
  fullyPaid,
  partial,
  paid,
  expected,
}: {
  fullyPaid: boolean;
  partial: boolean;
  paid: number;
  expected: number;
}) {
  if (fullyPaid) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-900 px-2 py-0.5 text-[10px] font-medium">
        Paid in full
      </span>
    );
  }
  if (partial) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-medium">
        Partial · €{paid.toFixed(2)}/€{expected.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-700 px-2 py-0.5 text-[10px] font-medium">
      Unpaid
    </span>
  );
}
