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
import { markPaymentPaidAction } from "@/lib/actions/payments";

type Method = "BANK" | "CASH";

export function PaymentRow({
  payment,
}: {
  payment: {
    id: string;
    installment: number;
    amountCents: number;
    dueDate: Date;
    paidAt: Date | null;
    method: Method | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<Method>("BANK");
  const [notes, setNotes] = useState("");

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await markPaymentPaidAction({
        paymentId: payment.id,
        method,
        paidAt,
        notes: notes.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const isPaid = !!payment.paidAt;
  return (
    <div className="rounded border bg-zinc-50/60 p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">
          Installment {payment.installment} · €{(payment.amountCents / 100).toFixed(2)}
        </div>
        {isPaid ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-medium">
            Paid {format(payment.paidAt!, "dd MMM yyyy")}
            {payment.method ? ` · ${payment.method.toLowerCase()}` : ""}
          </span>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
              <Button size="sm" variant="outline">
                Mark paid
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Mark installment {payment.installment} as paid
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  €{(payment.amountCents / 100).toFixed(2)} · due{" "}
                  {format(payment.dueDate, "dd MMM yyyy")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`paidAt-${payment.id}`}>Paid on</Label>
                    <Input
                      id={`paidAt-${payment.id}`}
                      type="date"
                      value={paidAt}
                      onChange={(e) => setPaidAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`method-${payment.id}`}>Method</Label>
                    <Select
                      value={method}
                      onValueChange={(v) => v && setMethod(v as Method)}
                    >
                      <SelectTrigger id={`method-${payment.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BANK">Bank transfer</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`notes-${payment.id}`}>Notes</Label>
                  <Textarea
                    id={`notes-${payment.id}`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Bank ref, partial-pay note, etc."
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Phase 4 will add proof PDF upload here. For now, attach
                  the proof manually in your records.
                </p>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={pending}>
                  {pending ? "Saving…" : "Mark paid"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="text-muted-foreground mt-1">
        Due {format(payment.dueDate, "dd MMM yyyy")}
      </div>
    </div>
  );
}
