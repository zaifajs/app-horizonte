"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Batch = { code: string };

const ANY = "__any__";

export function StudentsFilters({
  batches,
  initial,
}: {
  batches: Batch[];
  initial: {
    q: string;
    batch: string;
    status: string;
    paid: string;
    paidFrom: string;
    paidTo: string;
  };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "" || v === ANY) {
        next.delete(k);
      } else {
        next.set(k, v);
      }
    }
    const s = next.toString();
    startTransition(() => {
      router.replace(s ? `?${s}` : "/admin/students");
    });
  }

  function clearAll() {
    startTransition(() => router.replace("/admin/students"));
  }

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Field label="Search" htmlFor="q">
          <Input
            id="q"
            placeholder="Name, email, NIF, doc#…"
            defaultValue={initial.q}
            onChange={(e) => update({ q: e.target.value })}
          />
        </Field>
        <Field label="Batch" htmlFor="batch">
          <Select
            value={initial.batch || ANY}
            onValueChange={(v) => v && update({ batch: v })}
          >
            <SelectTrigger id="batch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any batch</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.code} value={b.code}>
                  {b.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Enrollment status" htmlFor="status">
          <Select
            value={initial.status || ANY}
            onValueChange={(v) => v && update({ status: v })}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Payment" htmlFor="paid">
          <Select
            value={initial.paid || ANY}
            onValueChange={(v) => v && update({ paid: v })}
          >
            <SelectTrigger id="paid">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any payment</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="full">Fully paid</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Field label="Last payment from" htmlFor="paidFrom">
          <Input
            id="paidFrom"
            type="date"
            defaultValue={initial.paidFrom}
            onChange={(e) => update({ paidFrom: e.target.value })}
          />
        </Field>
        <Field label="Last payment to" htmlFor="paidTo">
          <Input
            id="paidTo"
            type="date"
            defaultValue={initial.paidTo}
            onChange={(e) => update({ paidTo: e.target.value })}
          />
        </Field>
        <div className="md:col-span-2 flex items-end justify-end gap-2">
          <Button variant="outline" onClick={clearAll} disabled={pending}>
            Clear filters
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
