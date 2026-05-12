"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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

// Saved-view presets. Each value becomes a query string applied on top of
// the current state (other filters preserved where it makes sense).
const VIEW_OPTIONS: Array<{ key: string; label: string; params: Record<string, string | null> }> = [
  { key: "all",         label: "All",                       params: { urgency: null, status: null, paid: null } },
  { key: "pending",     label: "Pending activation",        params: { urgency: null, status: "PENDING", paid: null } },
  { key: "outstanding", label: "Has outstanding balance",   params: { urgency: null, status: "ACTIVE",  paid: "partial" } },
  { key: "unpaid",      label: "Unpaid",                    params: { urgency: null, status: null, paid: "unpaid" } },
  { key: "fully_paid",  label: "Fully paid",                params: { urgency: null, status: null, paid: "full" } },
];

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
  const [open, setOpen] = useState(false);

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

  // Count how many filters are active to label the collapsed header.
  const activeCount = [
    initial.q, initial.batch, initial.status, initial.paid,
    initial.paidFrom, initial.paidTo,
  ].filter((v) => v && v.length > 0).length;

  // Resolve current view from URL params.
  const currentView = VIEW_OPTIONS.find((v) =>
    Object.entries(v.params).every(([k, val]) => (val ?? "") === (sp.get(k) ?? "")),
  )?.key ?? "all";

  return (
    <div className="rounded-xl border bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm"
      >
        <span className="flex items-center gap-2 font-medium">
          Filters
          {activeCount > 0 ? (
            <span className="inline-flex items-center justify-center rounded-full bg-zinc-900 text-white text-[10px] font-semibold h-5 min-w-5 px-1.5">
              {activeCount}
            </span>
          ) : null}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="border-t px-4 py-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="View" htmlFor="view">
              <Select
                value={currentView}
                onValueChange={(v) => {
                  const opt = VIEW_OPTIONS.find((x) => x.key === v);
                  if (opt) update(opt.params);
                }}
              >
                <SelectTrigger id="view">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_OPTIONS.map((v) => (
                    <SelectItem key={v.key} value={v.key}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="md:col-span-3" />
          </div>
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
      ) : null}
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
