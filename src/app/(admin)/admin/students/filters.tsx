"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
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

const VIEW_PILLS: Array<{ key: string; label: string; params: Record<string, string | null> }> = [
  { key: "all",         label: "All",          params: { status: null, paid: null } },
  { key: "pending",     label: "Pending",      params: { status: "PENDING", paid: null } },
  { key: "outstanding", label: "Outstanding",  params: { status: "ACTIVE", paid: "partial" } },
  { key: "unpaid",      label: "Unpaid",       params: { status: null, paid: "unpaid" } },
  { key: "fully_paid",  label: "Fully paid",   params: { status: null, paid: "full" } },
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

  const activeCount = [
    initial.q, initial.batch, initial.status, initial.paid,
  ].filter((v) => v && v.length > 0).length;

  const currentView = VIEW_PILLS.find((v) =>
    Object.entries(v.params).every(([k, val]) => (val ?? "") === (sp.get(k) ?? "")),
  )?.key ?? "all";

  return (
    <div className="rounded-xl border bg-white">
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded-md hover:bg-zinc-100"
        >
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Filters
          {activeCount > 0 ? (
            <span className="inline-flex items-center justify-center rounded-full bg-zinc-900 text-white text-[10px] font-semibold h-4 min-w-4 px-1">
              {activeCount}
            </span>
          ) : null}
        </button>

        <span className="h-4 w-px bg-zinc-200" />

        <div className="flex flex-wrap items-center gap-1">
          {VIEW_PILLS.map((v) => {
            const isActive = currentView === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => update(v.params)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="border-t px-4 py-3 grid grid-cols-1 md:grid-cols-4 gap-3">
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
