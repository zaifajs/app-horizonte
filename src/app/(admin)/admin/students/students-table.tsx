"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  filtersToSearchString,
  parseFilters,
  type StudentRow,
} from "@/lib/students/filters";
import { ClickableRow } from "./clickable-row";
import { QuickPay } from "./quick-pay";
import { StudentDrawer } from "./student-drawer";
import {
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "./bulk-actions";
import type { BulkRow } from "./bulk-whatsapp-queue";

const URGENCY_ROW_BG: Record<string, string> = {
  paid: "bg-emerald-100 hover:bg-emerald-200/60",
  partial: "bg-amber-100 hover:bg-amber-200/60",
  due_soon: "bg-orange-200 hover:bg-orange-300/70",
  overdue: "bg-red-100 hover:bg-red-200/60",
  pre_start: "",
  withdrawn: "bg-zinc-100",
};

function SortableHeader({
  filters,
  sort,
  align,
  children,
}: {
  filters: ReturnType<typeof parseFilters>;
  sort:
    | "name"
    | "batch"
    | "batchSeq"
    | "paid"
    | "due"
    | "lastPaid"
    | "registered";
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const isActive = filters.sort === sort;
  const nextDir = isActive && filters.dir === "asc" ? "desc" : "asc";
  const href = `/admin/students${filtersToSearchString(filters, { sort, dir: nextDir })}`;
  const arrow = isActive ? (filters.dir === "asc" ? "↑" : "↓") : "";
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <Link
        href={href}
        className={`inline-flex items-center gap-1 hover:underline ${
          isActive ? "text-foreground font-medium" : ""
        }`}
      >
        {children}
        <span className="text-muted-foreground">{arrow}</span>
      </Link>
    </TableHead>
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

  return (
    <>
      <SelectionProvider allIds={visibleIds} rowsForQueue={queueMap}>
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <SelectAllCheckbox rowIds={visibleIds} />
                </TableHead>
                <TableHead className="w-12">#</TableHead>
                <SortableHeader filters={filters} sort="name">Name</SortableHeader>
                <TableHead>Phone</TableHead>
                <SortableHeader filters={filters} sort="batch">Batch</SortableHeader>
                <SortableHeader filters={filters} sort="paid" align="right">Paid</SortableHeader>
                <SortableHeader filters={filters} sort="due" align="right">Due</SortableHeader>
                <TableHead className="w-20 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <ClickableRow
                  key={r.id}
                  onRowClick={() => setSelectedId(r.id)}
                  className={`${URGENCY_ROW_BG[r.urgency] ?? ""} ${
                    r.urgency === "withdrawn" ? "opacity-60" : ""
                  }`}
                >
                  <TableCell className="w-8">
                    <RowCheckbox id={r.id} />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {/* Hard navigation — bypasses parallel route interception */}
                    <a
                      href={`/admin/students/${r.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.fullName}
                    </a>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.phone}</TableCell>
                  <TableCell>
                    {r.latestEnrollment ? (
                      <span className="inline-flex items-center gap-1">
                        {r.latestEnrollment.batchCode}
                        <Badge
                          variant="outline"
                          className={
                            r.latestEnrollment.status === "PENDING"
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : r.latestEnrollment.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                : ""
                          }
                        >
                          {r.latestEnrollment.status.toLowerCase()}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    €{(r.paidCents / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.dueCents === 0 ? (
                      <span className="text-muted-foreground">€0.00</span>
                    ) : (
                      <span className="text-amber-700 font-medium">
                        €{(r.dueCents / 100).toFixed(2)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.latestEnrollment && r.dueCents > 0 ? (
                      <QuickPay
                        enrollmentId={r.latestEnrollment.id}
                        studentName={r.fullName}
                        remainingCents={r.dueCents}
                        feeCents={r.latestEnrollment.feeCents}
                        paidCents={r.paidCents}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SelectionProvider>

      <StudentDrawer studentId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
