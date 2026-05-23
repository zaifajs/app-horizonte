"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type View = {
  label: string;
  query: string;
};

const VIEWS: View[] = [
  { label: "All", query: "" },
  { label: "Pending activation", query: "?status=PENDING" },
  { label: "Has outstanding balance", query: "?paid=partial&status=ACTIVE" },
  { label: "Unpaid", query: "?paid=unpaid" },
  { label: "Fully paid", query: "?paid=full" },
];

function normalize(q: string) {
  const usp = new URLSearchParams(q.replace(/^\?/, ""));
  usp.delete("sort");
  usp.delete("dir");
  usp.delete("q");
  return Array.from(usp.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

export function SavedViews() {
  const sp = useSearchParams();
  const currentKey = normalize(`?${sp.toString()}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">
        Views
      </span>
      {VIEWS.map((v) => {
        const isActive = normalize(v.query) === currentKey;
        return (
          <Link
            key={v.label}
            href={`/admin/students${v.query}`}
            className={`text-xs rounded-full border px-2.5 py-1 ${
              isActive
                ? "bg-foreground text-background border-zinc-900"
                : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}
