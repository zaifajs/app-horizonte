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
  addPaymentAction,
  deletePaymentAction,
} from "@/lib/actions/payments";

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
}: {
  enrollmentId: string;
  feeCents: number;
  payments: Payment[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalPaidCents = payments.reduce((a, p) => a + p.amountCents, 0);
  const feeEur = feeCents / 100;
  const paidEur = totalPaidCents / 100;
  const leftEur = Math.max(0, feeEur - paidEur);
  const fullyPaid = totalPaidCents >= feeCents;
  const pct = Math.min(100, Math.round((totalPaidCents / feeCents) * 100));

  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState(leftEur.toFixed(2));
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<Method>("BANK");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await addPaymentAction({
        enrollmentId,
        amount,
        method,
        paidAt,
        notes: notes.trim() || null,
        proof,
        isVerified,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotes("");
      setAmount("");
      setProof(null);
      setIsVerified(false);
      setOpen(false);
      router.refresh();
    });
  }

  function remove(paymentId: string) {
    if (!confirm("Delete this payment? Activation state will not auto-revert.")) return;
    startTransition(async () => {
      const result = await deletePaymentAction({ paymentId });
      if (!result.ok && result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Progress bar / summary */}
      <div className="rounded-lg border bg-white p-3 space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <div>
            <span className="font-medium">€{paidEur.toFixed(2)}</span>
            <span className="text-muted-foreground"> paid of €{feeEur.toFixed(2)}</span>
          </div>
          <div className="text-xs">
            {fullyPaid ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-900 px-2 py-0.5 font-medium">
                Fully paid
              </span>
            ) : (
              <span className="text-amber-700">
                €{leftEur.toFixed(2)} left to pay
              </span>
            )}
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full ${fullyPaid ? "bg-emerald-500" : "bg-amber-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* List of payments */}
      {payments.length > 0 ? (
        <ul className="space-y-1.5">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded border bg-white px-3 py-2 text-sm"
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
                    className="underline text-zinc-700 hover:text-foreground"
                  >
                    View proof
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(p.id)}
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

      <div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button size="sm" variant={fullyPaid ? "outline" : "default"}>
              {payments.length === 0 ? "Record first payment" : "Record another payment"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Fee €{feeEur.toFixed(2)} · received €{paidEur.toFixed(2)} ·{" "}
                {fullyPaid ? "fully paid" : `€${leftEur.toFixed(2)} left`}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`amount-${enrollmentId}`}>Amount (€)</Label>
                  <Input
                    id={`amount-${enrollmentId}`}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`paidAt-${enrollmentId}`}>Paid on</Label>
                  <Input
                    id={`paidAt-${enrollmentId}`}
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`method-${enrollmentId}`}>Method</Label>
                <Select value={method} onValueChange={(v) => v && setMethod(v as Method)}>
                  <SelectTrigger id={`method-${enrollmentId}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK">Bank transfer</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`proof-${enrollmentId}`}>
                  Bank proof (PDF or image)
                  <span className="text-muted-foreground"> · optional</span>
                </Label>
                <Input
                  id={`proof-${enrollmentId}`}
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`notes-${enrollmentId}`}>Notes</Label>
                <Textarea
                  id={`notes-${enrollmentId}`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Bank reference, payment context, etc."
                />
              </div>
              <label className="flex items-start gap-2 rounded-lg border bg-zinc-50 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                />
                <span>
                  <span className="font-medium">Verified</span>
                  <span className="text-muted-foreground">
                    {" "}— I confirmed this payment landed in the bank/cash on hand.
                  </span>
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                Recording the <strong>first</strong> payment activates the
                enrollment automatically.
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
    </div>
  );
}
