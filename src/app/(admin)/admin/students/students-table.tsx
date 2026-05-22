"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  filtersToSearchString,
  parseFilters,
  type StudentRow,
  type Urgency,
} from "@/lib/students/filters";
import { QuickPay } from "./quick-pay";
import { StudentDrawer } from "./student-drawer";
import {
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
  useSelection,
} from "./bulk-actions";
import type { BulkRow } from "./bulk-whatsapp-queue";

const RAIL_COLOR: Record<Urgency, string> = {
  overdue: "var(--hz-danger)",
  partial: "var(--hz-warning)",
  due_soon: "var(--hz-accent)",
  paid: "var(--hz-success)",
  pre_start: "var(--hz-info)",
  withdrawn: "var(--hz-muted)",
};

const ROW_TINT_CLASS: Record<Urgency, string> = {
  overdue: "t-overdue",
  partial: "t-partial",
  due_soon: "t-due",
  paid: "",
  pre_start: "",
  withdrawn: "",
};

const URGENCY_AVATAR_STYLE: Partial<Record<Urgency, { color: string; bg: string; border: string }>> = {
  overdue: {
    color: "var(--hz-danger)",
    bg: "var(--hz-danger-50)",
    border: "rgba(248,113,113,0.25)",
  },
  partial: {
    color: "var(--hz-warning)",
    bg: "var(--hz-warning-50)",
    border: "rgba(244,181,63,0.25)",
  },
  due_soon: {
    color: "var(--hz-accent)",
    bg: "var(--hz-accent-50)",
    border: "rgba(255,122,69,0.25)",
  },
};

const PAYMENT_PILL: Record<Urgency, { label: string; color: string }> = {
  overdue: { label: "OVERDUE", color: "var(--hz-danger)" },
  partial: { label: "PARTIAL", color: "var(--hz-warning)" },
  due_soon: { label: "DUE SOON", color: "var(--hz-accent)" },
  paid: { label: "PAID", color: "var(--hz-success)" },
  pre_start: { label: "AWAITING", color: "var(--hz-info)" },
  withdrawn: { label: "WITHDRAWN", color: "var(--hz-muted)" },
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "??"
  );
}

function daysAgo(date: Date, now: Date): number {
  const dayMs = 86_400_000;
  return Math.floor((now.getTime() - date.getTime()) / dayMs);
}

function SortableHeader({
  filters,
  sort,
  align,
  className,
  children,
}: {
  filters: ReturnType<typeof parseFilters>;
  sort: "name" | "batch" | "batchSeq" | "paid" | "due" | "lastPaid" | "registered";
  align?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  const isActive = filters.sort === sort;
  const nextDir = isActive && filters.dir === "asc" ? "desc" : "asc";
  const href = `/admin/students${filtersToSearchString(filters, { sort, dir: nextDir })}`;
  const arrow = isActive ? (filters.dir === "asc" ? "↑" : "↓") : "";
  return (
    <th className={className} style={align === "right" ? { textAlign: "right" } : undefined}>
      <a href={href} className="inline-flex items-center gap-1 hover:text-[var(--hz-ink)]">
        {children}
        {arrow ? <span style={{ color: "var(--hz-primary)" }}>{arrow}</span> : null}
      </a>
    </th>
  );
}

export function StudentsTable({
  rows,
  queueRows,
  filters,
}: {
  rows: StudentRow[];
  queueRows: [string, BulkRow][];
  filters: ReturnType<typeof parseFilters>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleIds = rows.map((r) => r.id);
  const queueMap = new Map(queueRows);
  const now = new Date();

  return (
    <>
      <SelectionProvider allIds={visibleIds} rowsForQueue={queueMap}>
        <div className="hz-card overflow-hidden">
          <table className="stbl">
            <thead>
              <tr>
                <th style={{ width: 36, paddingRight: 0 }}>
                  <SelectAllCheckbox rowIds={visibleIds} />
                </th>
                <th style={{ width: 50 }}>#</th>
                <SortableHeader filters={filters} sort="name">
                  Student
                </SortableHeader>
                <SortableHeader filters={filters} sort="batch" className="w-[100px]">
                  Batch
                </SortableHeader>
                <th style={{ width: 200 }}>Payment</th>
                <th style={{ width: 200 }}>Phone</th>
                <SortableHeader filters={filters} sort="registered" className="w-[130px]">
                  Enrolled
                </SortableHeader>
                <th style={{ width: 100, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <StudentRowEl
                  key={r.id}
                  row={r}
                  index={i + 1}
                  now={now}
                  onSelect={() => setSelectedId(r.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </SelectionProvider>

      <StudentDrawer studentId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}

function StudentRowEl({
  row,
  index,
  now,
  onSelect,
}: {
  row: StudentRow;
  index: number;
  now: Date;
  onSelect: () => void;
}) {
  const router = useRouter();
  const { isSelected } = useSelection();
  const selected = isSelected(row.id);
  const tintClass = ROW_TINT_CLASS[row.urgency] ?? "";
  const aviStyle = URGENCY_AVATAR_STYLE[row.urgency];
  const pill = PAYMENT_PILL[row.urgency];
  const railColor = RAIL_COLOR[row.urgency];
  const railOpacity = row.urgency === "paid" ? 0.6 : 1;
  const cleanPhone = row.phone.replace(/\D+/g, "");
  const ago = row.latestEnrollment ? daysAgo(row.latestEnrollment.enrolledAt, now) : null;
  const days = row.daysToDeadline ?? null;

  function onRowClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'button, a, [role="dialog"], [role="menu"], input, label, [data-no-navigate]',
      )
    ) {
      return;
    }
    onSelect();
  }

  return (
    <tr
      className={`cursor-pointer ${tintClass} ${selected ? "sel" : ""} ${row.urgency === "withdrawn" ? "opacity-60" : ""}`}
      onClick={onRowClick}
      onAuxClick={(e) => {
        if (e.button === 1) router.push(`/admin/students/${row.id}`);
      }}
    >
      <td>
        <RowCheckbox id={row.id} />
      </td>
      <td className="rail-cell">
        <span className="r" style={{ background: railColor, opacity: railOpacity }} />
        <span className="hz-mono text-[14px]" style={{ color: "var(--hz-ink-3)" }}>
          {String(index).padStart(2, "0")}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-2.5">
          <span
            className="avi"
            style={
              aviStyle
                ? {
                    color: aviStyle.color,
                    background: aviStyle.bg,
                    borderColor: aviStyle.border,
                  }
                : undefined
            }
          >
            {initials(row.fullName)}
          </span>
          <div className="min-w-0">
            <a
              href={`/admin/students/${row.id}`}
              className="font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.fullName}
            </a>
            <div className="text-[13px] hz-mono truncate" style={{ color: "var(--hz-ink-3)" }}>
              {row.email}
            </div>
          </div>
        </div>
      </td>
      <td>
        {row.latestEnrollment ? (
          <span className="hz-mono text-[14px] font-semibold" style={{ color: "var(--hz-primary)" }}>
            {row.latestEnrollment.batchCode}
          </span>
        ) : (
          <span style={{ color: "var(--hz-ink-3)" }}>—</span>
        )}
      </td>
      <td>
        {row.latestEnrollment ? (
          <>
            <div className="status-pill" style={{ color: pill.color }}>
              <span className="dot" style={{ background: pill.color }} />
              {pill.label}
              {row.urgency === "overdue" && days != null ? ` · +${Math.abs(days)}d` : null}
              {row.urgency === "due_soon" && days != null ? ` · ${days}d` : null}
            </div>
            <div className="text-[13px] hz-mono mt-1" style={{ color: "var(--hz-ink-2)" }}>
              €{(row.paidCents / 100).toFixed(0)} / €
              {(row.latestEnrollment.feeCents / 100).toFixed(0)}
            </div>
          </>
        ) : (
          <span style={{ color: "var(--hz-ink-3)" }}>—</span>
        )}
      </td>
      <td>
        <div className="flex items-center gap-2">
          <span className="hz-mono text-[14px]">{row.phone}</span>
          {cleanPhone ? (
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ibtn"
              style={{ width: 24, height: 24 }}
              title="Send WhatsApp"
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--hz-success)" }}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </a>
          ) : null}
        </div>
      </td>
      <td>
        {row.latestEnrollment ? (
          <>
            <div className="hz-mono text-[14px]" style={{ color: "var(--hz-ink-2)" }}>
              {row.latestEnrollment.enrolledAt.toISOString().slice(0, 10)}
            </div>
            {ago != null ? (
              <div className="hz-mono text-[12px]" style={{ color: "var(--hz-ink-3)" }}>
                {ago}d ago
              </div>
            ) : null}
          </>
        ) : (
          <span style={{ color: "var(--hz-ink-3)" }}>—</span>
        )}
      </td>
      <td style={{ textAlign: "right" }}>
        {row.latestEnrollment && row.dueCents > 0 ? (
          <span onClick={(e) => e.stopPropagation()}>
            <QuickPay
              enrollmentId={row.latestEnrollment.id}
              studentName={row.fullName}
              remainingCents={row.dueCents}
              feeCents={row.latestEnrollment.feeCents}
              paidCents={row.paidCents}
            />
          </span>
        ) : (
          <span className="hz-mono" style={{ color: "var(--hz-ink-3)" }}>—</span>
        )}
      </td>
    </tr>
  );
}
