"use client";

import { useMemo, useState } from "react";
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
import { SelectionRibbon } from "./selection-ribbon";
import { MessageComposer } from "./message-composer";
import { Avatar } from "@/components/ui/avatar";
import type { ResolvedTemplate } from "@/lib/messaging/template-store";

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

const PAYMENT_PILL: Record<Urgency, { label: string; color: string }> = {
  overdue: { label: "OVERDUE", color: "var(--hz-danger)" },
  partial: { label: "PARTIAL", color: "var(--hz-warning)" },
  due_soon: { label: "DUE SOON", color: "var(--hz-accent)" },
  paid: { label: "PAID", color: "var(--hz-success)" },
  pre_start: { label: "AWAITING", color: "var(--hz-info)" },
  withdrawn: { label: "WITHDRAWN", color: "var(--hz-muted)" },
};

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
  templates,
}: {
  rows: StudentRow[];
  queueRows: [string, BulkRow][];
  filters: ReturnType<typeof parseFilters>;
  templates: ResolvedTemplate[];
}) {
  const visibleIds = rows.map((r) => r.id);
  const queueMap = new Map(queueRows);
  const now = new Date();

  return (
    <SelectionProvider rowsForQueue={queueMap}>
      <TableInner rows={rows} visibleIds={visibleIds} filters={filters} now={now} templates={templates} />
    </SelectionProvider>
  );
}

function TableInner({
  rows,
  visibleIds,
  filters,
  now,
  templates,
}: {
  rows: StudentRow[];
  visibleIds: string[];
  filters: ReturnType<typeof parseFilters>;
  now: Date;
  templates: ResolvedTemplate[];
}) {
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  // When a row's WA icon opens the composer, we pin to one row regardless of
  // the bulk selection set.
  const [singleId, setSingleId] = useState<string | null>(null);
  const { selected, rowsForQueue, toggle } = useSelection();

  const composerRecipients = useMemo(() => {
    if (singleId) {
      const r = rowsForQueue.get(singleId);
      return r ? [r] : [];
    }
    return Array.from(selected)
      .map((id) => rowsForQueue.get(id))
      .filter((r): r is BulkRow => !!r);
  }, [singleId, selected, rowsForQueue]);

  function openComposerForRow(id: string) {
    setSingleId(id);
    setComposerOpen(true);
  }

  function openComposerForSelection() {
    setSingleId(null);
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerOpen(false);
    setSingleId(null);
  }

  function removeRecipient(id: string) {
    if (singleId) {
      closeComposer();
      return;
    }
    toggle(id);
  }

  return (
    <>
      <SelectionRibbon
        visibleCount={visibleIds.length}
        onSendWhatsApp={openComposerForSelection}
      />
      <div className="hz-card overflow-x-auto">          <table className="stbl">
            <thead>
              <tr>
                <th style={{ width: 36, paddingRight: 0 }}>
                  <SelectAllCheckbox rowIds={visibleIds} />
                </th>
                <th style={{ width: 50 }}>#</th>
                {/* Student column takes whatever's left after the fixed-width
                    columns below. Used to hog the row because nothing else
                    had a fixed width. */}
                <SortableHeader filters={filters} sort="name" className="min-w-[200px]">
                  Student
                </SortableHeader>
                <SortableHeader filters={filters} sort="batch" className="w-[80px]">
                  Batch
                </SortableHeader>
                <th style={{ width: 180 }}>Payment</th>
                <th style={{ width: 200 }}>Phone</th>
                <th style={{ width: 110, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <StudentRowEl
                  key={r.id}
                  row={r}
                  index={i + 1}
                  now={now}
                  onOpenDrawer={() => setDrawerId(r.id)}
                  onSendWhatsApp={() => openComposerForRow(r.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

      <StudentDrawer studentId={drawerId} onClose={() => setDrawerId(null)} />
      <MessageComposer
        open={composerOpen}
        onClose={closeComposer}
        recipients={composerRecipients}
        onRemoveRecipient={removeRecipient}
        templates={templates}
      />
    </>
  );
}

function StudentRowEl({
  row,
  index,
  now,
  onOpenDrawer,
  onSendWhatsApp,
}: {
  row: StudentRow;
  index: number;
  now: Date;
  onOpenDrawer: () => void;
  onSendWhatsApp: () => void;
}) {
  const router = useRouter();
  const { isSelected } = useSelection();
  const selected = isSelected(row.id);
  const pill = PAYMENT_PILL[row.urgency];
  const cleanPhone = row.phone.replace(/\D+/g, "");
  const days = row.daysToDeadline ?? null;
  // Soft-rail policy: reserve red for *strongly* actionable rows so the
  // colour retains signal when most students happen to be overdue.
  // Overdue ≤ 7d demotes to amber; ≥ 8d stays red.
  const isStronglyOverdue =
    row.urgency === "overdue" && days != null && Math.abs(days) >= 8;
  const railColor = isStronglyOverdue
    ? RAIL_COLOR.overdue
    : row.urgency === "overdue"
      ? RAIL_COLOR.partial
      : RAIL_COLOR[row.urgency];
  const tintClass = isStronglyOverdue
    ? ROW_TINT_CLASS.overdue
    : row.urgency === "overdue"
      ? ROW_TINT_CLASS.partial
      : ROW_TINT_CLASS[row.urgency] ?? "";
  const railOpacity = row.urgency === "paid" ? 0.6 : 0.85;

  function onRowClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'button, a, [role="dialog"], [role="menu"], input, label, [data-no-navigate]',
      )
    ) {
      return;
    }
    onOpenDrawer();
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
        <span className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
          {String(index).padStart(2, "0")}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-2.5">
          <Avatar name={row.fullName} />
          <div className="min-w-0">
            <a
              href={`/admin/students/${row.id}`}
              className="font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.fullName}
            </a>
            <div className="text-xs hz-mono truncate" style={{ color: "var(--hz-ink-3)" }}>
              {row.email}
            </div>
          </div>
        </div>
      </td>
      <td>
        {row.latestEnrollment ? (
          <span className="hz-mono text-sm font-semibold" style={{ color: "var(--hz-primary)" }}>
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
            <div className="text-xs hz-mono mt-1" style={{ color: "var(--hz-ink-2)" }}>
              €{(row.paidCents / 100).toFixed(0)} / €
              {(row.latestEnrollment.feeCents / 100).toFixed(0)}
            </div>
          </>
        ) : (
          <span style={{ color: "var(--hz-ink-3)" }}>—</span>
        )}
      </td>
      <td>
        {/* Phone cell is now just the number — wider column lets the typical
            "+351 92 273 6183" string fit on one line without wrapping. */}
        <span className="hz-mono text-sm whitespace-nowrap">{row.phone}</span>
      </td>
      <td style={{ textAlign: "right" }}>
        {/* Unified Actions cell: WhatsApp compose + record-payment side by
            side. Empty row gets a neutral em-dash; rows with neither phone
            nor outstanding balance fall back to that. */}
        <div className="flex items-center justify-end gap-1.5">
          {cleanPhone ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSendWhatsApp();
              }}
              className="ibtn"
              style={{ width: 36, height: 36 }}
              title="Compose WhatsApp message"
              aria-label={`Send WhatsApp to ${row.fullName}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--hz-success)" }}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </button>
          ) : null}
          {row.latestEnrollment && row.dueCents > 0 ? (
            <span onClick={(e) => e.stopPropagation()}>
              <QuickPay
                enrollmentId={row.latestEnrollment.id}
                studentId={row.id}
                studentName={row.fullName}
                remainingCents={row.dueCents}
                feeCents={row.latestEnrollment.feeCents}
                paidCents={row.paidCents}
                studentEmail={row.email}
                batchCode={row.latestEnrollment.batchCode}
                urgencyTone={
                  row.urgency === "overdue"
                    ? "danger"
                    : row.urgency === "partial"
                      ? "warning"
                      : row.urgency === "due_soon"
                        ? "due"
                        : "neutral"
                }
              />
            </span>
          ) : null}
          {!cleanPhone && (!row.latestEnrollment || row.dueCents <= 0) ? (
            <span className="hz-mono" style={{ color: "var(--hz-ink-3)" }}>—</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
