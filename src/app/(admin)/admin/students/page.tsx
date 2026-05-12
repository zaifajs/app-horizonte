import Link from "next/link";
import { headers } from "next/headers";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import {
  applyComputedFilters,
  buildStudentWhere,
  computeUrgency,
  filtersToSearchString,
  parseFilters,
  progressOf,
  sortRows,
  type StudentRow,
  type Urgency,
} from "@/lib/students/filters";
import { StudentsFilters } from "./filters";
import { ExportDialog } from "./export-dialog";
import { QuickPay } from "./quick-pay";
import { ClickableRow } from "./clickable-row";
import {
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "./bulk-actions";
import type { BulkRow } from "./bulk-whatsapp-queue";
import { loadBatchSequence } from "@/lib/students/batch-seq";
import { localeForNationality } from "@/lib/messaging/locale-for-nationality";

export const dynamic = "force-dynamic";

export const metadata = { title: "Students · Horizonte CRM" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const where = buildStudentWhere(filters);

  const [studentsRaw, batches, batchSeq] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        enrollments: {
          include: {
            batch: {
              select: {
                id: true,
                code: true,
                startDate: true,
                course: { select: { feeCents: true } },
              },
            },
            payments: { select: { amountCents: true, paidAt: true } },
          },
          orderBy: { enrolledAt: "desc" },
        },
      },
      take: 500,
    }),
    prisma.batch.findMany({ orderBy: { startDate: "desc" }, select: { code: true } }),
    loadBatchSequence(),
  ]);

  // Build rows + compute paid/due/lastPaid + urgency.
  const today = new Date();
  const rows: StudentRow[] = studentsRaw.map((s) => {
    const enr = s.enrollments[0] ?? null;
    const paid = enr?.payments.reduce((a, p) => a + p.amountCents, 0) ?? 0;
    const fee = enr?.batch.course.feeCents ?? 0;
    const due = enr ? Math.max(0, fee - paid) : 0;
    const lastPaidAt = enr && enr.payments.length > 0
      ? enr.payments
          .map((p) => p.paidAt)
          .sort((a, b) => b.getTime() - a.getTime())[0]
      : null;
    const { urgency, daysToDeadline } = computeUrgency({
      enrollmentStatus: enr?.status ?? null,
      batchStartDate: enr?.batch.startDate ?? null,
      paidCents: paid,
      feeCents: fee,
      today,
    });
    return {
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      phone: s.phone,
      city: s.city,
      createdAt: s.createdAt,
      latestEnrollment: enr
        ? {
            id: enr.id,
            status: enr.status,
            batchCode: enr.batch.code,
            batchStartDate: enr.batch.startDate ?? null,
            batchSeq: batchSeq.get(enr.id) ?? null,
            enrolledAt: enr.enrolledAt,
            feeCents: fee,
          }
        : null,
      paidCents: paid,
      dueCents: due,
      lastPaidAt,
      paymentProgress: progressOf(paid, fee),
      urgency,
      daysToDeadline,
    };
  });

  // Counts by urgency for the summary bar — computed BEFORE applying urgency
  // filter so the chips always show the full denominator across the rest of
  // the active filters.
  const urgencyCounts: Record<Urgency, number> = {
    paid: 0, partial: 0, due_soon: 0, overdue: 0, pre_start: 0, withdrawn: 0,
  };
  for (const r of applyComputedFilters(rows, { ...filters, urgency: null })) {
    urgencyCounts[r.urgency] += 1;
  }

  const filtered = applyComputedFilters(rows, filters);
  const sorted = sortRows(filtered, filters);

  // Build the bulk-queue lookup map keyed by student id.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "stage.nhorizonte.pt";
  const queueRows = new Map<string, BulkRow>();
  for (const s of studentsRaw) {
    const enr = s.enrollments[0] ?? null;
    const loc = localeForNationality(s.nationality);
    const paid = enr?.payments.reduce((a, p) => a + p.amountCents, 0) ?? 0;
    const fee = enr?.batch.course.feeCents ?? 0;
    const due = Math.max(0, fee - paid);
    queueRows.set(s.id, {
      studentId: s.id,
      fullName: s.fullName,
      phone: s.phone,
      locale: loc,
      vars: {
        name: s.fullName.split(" ")[0],
        batch: enr?.batch.code ?? "—",
        startDate: enr?.batch.startDate.toISOString().slice(0, 10) ?? "",
        dueAmount: `€${(due / 100).toFixed(2)}`,
        nextSessionDate: "tomorrow",
        scheduleUrl: enr
          ? `${proto}://${host}/${loc}/turma/${enr.batch.id}`
          : undefined,
      },
    });
  }
  const visibleIds = sorted.map((r) => r.id);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-zinc-50 to-white p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Students
            </h1>
            <p className="text-sm text-muted-foreground">
              {sorted.length === rows.length
                ? `${rows.length} students total`
                : `${sorted.length} shown of ${rows.length} total`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportDialog />
            <Link href="/admin/students/new">
              <Button>Add student</Button>
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          <SummaryCard
            label="Paid"
            value={urgencyCounts.paid}
            cls="bg-emerald-50 border-emerald-200 text-emerald-900"
          />
          <SummaryCard
            label="Partial"
            value={urgencyCounts.partial}
            cls="bg-amber-50 border-amber-200 text-amber-900"
          />
          <SummaryCard
            label="Due soon"
            value={urgencyCounts.due_soon}
            cls="bg-orange-100 border-orange-300 text-orange-900"
          />
          <SummaryCard
            label="Overdue"
            value={urgencyCounts.overdue}
            cls="bg-red-100 border-red-300 text-red-900"
          />
          <SummaryCard
            label="Pre-start"
            value={urgencyCounts.pre_start}
            cls="bg-zinc-50 border-zinc-200 text-zinc-700"
          />
        </div>
      </div>

      <StudentsFilters
        batches={batches}
        initial={{
          q: filters.q ?? "",
          batch: filters.batch ?? "",
          status: filters.enrollmentStatus ?? "",
          paid: filters.paymentProgress ?? "",
          paidFrom: filters.paidFrom ?? "",
          paidTo: filters.paidTo ?? "",
        }}
      />

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No students match these filters.
        </div>
      ) : (
        <SelectionProvider allIds={visibleIds} rowsForQueue={queueRows}>
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
              {sorted.map((r, i) => (
                <ClickableRow
                  key={r.id}
                  href={`/admin/students/${r.id}`}
                  className={`${URGENCY_ROW_BG[r.urgency]} ${
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
                    <Link href={`/admin/students/${r.id}`} className="hover:underline">
                      {r.fullName}
                    </Link>
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
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  cls,
}: {
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

const URGENCY_ROW_BG: Record<Urgency, string> = {
  paid: "bg-emerald-100 hover:bg-emerald-200/60",
  // Visible amber so partial-paid rows actually read. Matches the
  // amber-700 "due amount" text cue elsewhere.
  partial: "bg-amber-100 hover:bg-amber-200/60",
  due_soon: "bg-orange-200 hover:bg-orange-300/70",
  overdue: "bg-red-100 hover:bg-red-200/60",
  // Pre-start: no tint — no money received yet AND class hasn't started.
  pre_start: "",
  withdrawn: "bg-zinc-100",
};

const URGENCY_CHIP: Record<Urgency, { label: string; cls: string }> = {
  paid:     { label: "Paid",        cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  partial:  { label: "Partial",     cls: "bg-yellow-100 text-yellow-900 border-yellow-300" },
  due_soon: { label: "Due soon",    cls: "bg-orange-200 text-orange-950 border-orange-400" },
  overdue:  { label: "Overdue",     cls: "bg-red-100 text-red-900 border-red-300" },
  pre_start:{ label: "Pre-start",   cls: "bg-zinc-100 text-zinc-700 border-zinc-300" },
  withdrawn:{ label: "Withdrawn",   cls: "bg-zinc-100 text-zinc-500 border-zinc-300" },
};

function UrgencyBar({
  counts,
  current,
}: {
  counts: Record<Urgency, number>;
  current: Urgency | null;
}) {
  const order: Urgency[] = ["overdue", "due_soon", "partial", "paid", "pre_start", "withdrawn"];
  const total = order.reduce((a, k) => a + counts[k], 0);
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">
        At a glance
      </span>
      {order
        .filter((u) => counts[u] > 0)
        .map((u) => {
          const c = URGENCY_CHIP[u];
          const isActive = current === u;
          const href = current === u ? "/admin/students" : `/admin/students?urgency=${u}`;
          return (
            <Link
              key={u}
              href={href}
              className={`text-xs rounded-full border px-2.5 py-1 inline-flex items-center gap-1.5 ${
                isActive ? "ring-2 ring-foreground ring-offset-1" : ""
              } ${c.cls}`}
            >
              <span className="font-semibold tabular-nums">{counts[u]}</span>
              <span>{c.label}</span>
            </Link>
          );
        })}
    </div>
  );
}

function DeadlineCell({
  urgency,
  days,
}: {
  urgency: Urgency;
  days: number | null;
}) {
  if (urgency === "paid") return <span className="text-muted-foreground">—</span>;
  if (urgency === "withdrawn") return <span className="text-muted-foreground">—</span>;
  if (urgency === "pre_start") return <span className="text-muted-foreground">Pre-start</span>;
  if (days === null) return <span className="text-muted-foreground">—</span>;
  if (days < 0) return <span className="text-red-700 font-medium">{Math.abs(days)} days overdue</span>;
  if (days === 0) return <span className="text-orange-700 font-medium">Due today</span>;
  return <span className={days <= 7 ? "text-orange-700 font-medium" : ""}>{days} days left</span>;
}

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
