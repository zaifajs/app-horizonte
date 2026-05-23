"use client";

import Link from "next/link";

const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "year", label: "This year" },
  { value: "month", label: "This month" },
  { value: "30d", label: "Last 30 days" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "active", label: "Active + pending" },
  { value: "all", label: "All (incl. withdrawn)" },
];

export function FinanceFilters({
  currentRange,
  currentStatus,
}: {
  currentRange: string;
  currentStatus: string;
}) {
  // Each option is just a link with the new params — no client state needed.
  function hrefFor(patch: { range?: string; status?: string }): string {
    const params = new URLSearchParams();
    const range = patch.range ?? currentRange;
    const status = patch.status ?? currentStatus;
    if (range !== "all") params.set("range", range);
    if (status !== "active") params.set("status", status);
    const s = params.toString();
    return s ? `/admin/finance?${s}` : "/admin/finance";
  }

  return (
    <div className="flex items-start gap-3 flex-wrap">
      <FilterStrip
        label="Range"
        options={RANGE_OPTIONS}
        current={currentRange}
        hrefFor={(v) => hrefFor({ range: v })}
      />
      <FilterStrip
        label="Enrolments"
        options={STATUS_OPTIONS}
        current={currentStatus}
        hrefFor={(v) => hrefFor({ status: v })}
      />
    </div>
  );
}

function FilterStrip({
  label,
  options,
  current,
  hrefFor,
}: {
  label: string;
  options: { value: string; label: string }[];
  current: string;
  hrefFor: (v: string) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="hz-mono text-xs uppercase tracking-[.14em]"
        style={{ color: "var(--hz-ink-3)" }}
      >
        {label}
      </span>
      <div className="seg">
        {options.map((o) => (
          <Link
            key={o.value}
            href={hrefFor(o.value)}
            className={current === o.value ? "on" : ""}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
