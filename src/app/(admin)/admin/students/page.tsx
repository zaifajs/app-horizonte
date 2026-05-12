import Link from "next/link";
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
import { SavedViews } from "./saved-views";
import { ExportDialog } from "./export-dialog";
import { loadBatchSequence } from "@/lib/students/batch-seq";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">
            {sorted.length} of {rows.length} students shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDialog />
          <Link href="/admin/students/new">
            <Button>Add student</Button>
          </Link>
        </div>
      </div>

      <UrgencyBar counts={urgencyCounts} current={filters.urgency} />
      <SavedViews />
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
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                {filters.batch ? (
                  <SortableHeader filters={filters} sort="batchSeq">#</SortableHeader>
                ) : null}
                <SortableHeader filters={filters} sort="name">Name</SortableHeader>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <SortableHeader filters={filters} sort="batch">Batch</SortableHeader>
                <SortableHeader filters={filters} sort="paid" align="right">Paid</SortableHeader>
                <SortableHeader filters={filters} sort="due" align="right">Due</SortableHeader>
                <SortableHeader filters={filters} sort="lastPaid">Last paid</SortableHeader>
                <TableHead>Deadline</TableHead>
                <SortableHeader filters={filters} sort="registered">Registered</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow
                  key={r.id}
                  className={`${URGENCY_ROW_BG[r.urgency]} ${
                    r.urgency === "withdrawn" ? "opacity-60" : ""
                  }`}
                >
                  {filters.batch ? (
                    <TableCell className="text-muted-foreground tabular-nums">
                      {r.latestEnrollment?.batchSeq ?? "—"}
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium">
                    <Link href={`/admin/students/${r.id}`} className="hover:underline">
                      {r.fullName}
                    </Link>
                  </TableCell>
                  <TableCell>{r.email}</TableCell>
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
                  <TableCell>
                    {r.lastPaidAt ? format(r.lastPaidAt, "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    <DeadlineCell urgency={r.urgency} days={r.daysToDeadline} />
                  </TableCell>
                  <TableCell>{format(r.createdAt, "dd MMM yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

const URGENCY_ROW_BG: Record<Urgency, string> = {
  paid: "bg-emerald-50 hover:bg-emerald-100/60",
  partial: "bg-yellow-50 hover:bg-yellow-100/60",
  due_soon: "bg-orange-100 hover:bg-orange-200/60",
  overdue: "bg-red-50 hover:bg-red-100/60",
  pre_start: "",
  withdrawn: "bg-zinc-50",
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
