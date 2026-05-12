"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { addPaymentAction } from "@/lib/actions/payments";

type Method = "BANK" | "CASH";

export function QuickPay({
  enrollmentId,
  studentName,
  remainingCents,
  feeCents,
  paidCents,
}: {
  enrollmentId: string;
  studentName: string;
  remainingCents: number;
  feeCents: number;
  paidCents: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState((remainingCents / 100).toFixed(2));
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
      // Reset and close
      setAmount("");
      setNotes("");
      setProof(null);
      setIsVerified(false);
      setOpen(false);
      router.refresh();
    });
  }

  const feeEur = (feeCents / 100).toFixed(2);
  const paidEur = (paidCents / 100).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" variant="outline">
          Record payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment — {studentName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Fee €{feeEur} · received €{paidEur} · €
            {(remainingCents / 100).toFixed(2)} left
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`q-amount-${enrollmentId}`}>Amount (€)</Label>
              <Input
                id={`q-amount-${enrollmentId}`}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`q-paidAt-${enrollmentId}`}>Paid on</Label>
              <Input
                id={`q-paidAt-${enrollmentId}`}
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`q-method-${enrollmentId}`}>Method</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v as Method)}>
              <SelectTrigger id={`q-method-${enrollmentId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK">Bank transfer</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`q-proof-${enrollmentId}`}>
              Bank proof (PDF or image)
              <span className="text-muted-foreground"> · optional</span>
            </Label>
            <Input
              id={`q-proof-${enrollmentId}`}
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`q-notes-${enrollmentId}`}>Notes</Label>
            <Textarea
              id={`q-notes-${enrollmentId}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Bank ref, payment context, etc."
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
