"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useRef, useEffect } from "react";

type Batch = { code: string };

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
  const [q, setQ] = useState(initial.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    startTransition(() => {
      router.replace(s ? `?${s}` : "/admin/students");
    });
  }

  function onSearchChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => update({ q: value }), 250);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const activeCount = [initial.batch, initial.status, initial.paid].filter(
    (v) => v && v.length > 0,
  ).length;
  const filterChips: { label: string; clearKey: string }[] = [];
  if (initial.batch) filterChips.push({ label: `Batch: ${initial.batch}`, clearKey: "batch" });
  if (initial.paidFrom || initial.paidTo) {
    filterChips.push({
      label: `Paid ${initial.paidFrom || "…"}–${initial.paidTo || "…"}`,
      clearKey: "paidFrom",
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="inp flex-1" style={{ maxWidth: 420 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--hz-ink-3)" }}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          placeholder="Search name, email, phone, NIF…"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {pending ? (
          <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
            …
          </span>
        ) : null}
      </label>

      <div className="relative">
        <select
          value={initial.batch}
          onChange={(e) => update({ batch: e.target.value || null })}
          className="appearance-none btn-ghost"
          style={{ paddingRight: 26 }}
        >
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.code} value={b.code}>
              {b.code}
            </option>
          ))}
        </select>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--hz-ink-3)" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {filterChips.map((c) => (
        <button
          key={c.clearKey}
          type="button"
          className="chip chip-primary"
          onClick={() => {
            const patch: Record<string, string | null> = { [c.clearKey]: null };
            if (c.clearKey === "paidFrom") patch.paidTo = null;
            update(patch);
          }}
          title="Clear this filter"
        >
          {c.label}
          <span style={{ marginLeft: 4 }}>×</span>
        </button>
      ))}

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            startTransition(() => router.replace("/admin/students"));
            setQ("");
          }}
          className="btn-ghost text-sm"
          style={{ padding: "5px 10px" }}
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
