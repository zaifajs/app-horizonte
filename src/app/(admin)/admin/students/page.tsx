import Link from "next/link";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import {
  applyComputedFilters,
  buildStudentWhere,
  computeUrgency,
  parseFilters,
  progressOf,
  sortRows,
  type StudentRow,
  type Urgency,
} from "@/lib/students/filters";
import { StudentsFilters } from "./filters";
import { ExportDialog } from "./export-dialog";
import type { BulkRow } from "./bulk-whatsapp-queue";
import { loadBatchSequence } from "@/lib/students/batch-seq";
import { localeForNationality } from "@/lib/messaging/locale-for-nationality";
import { StudentsTable } from "./students-table";

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
      email: s.email,
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
        <StudentsTable rows={sorted} queueRows={Array.from(queueRows.entries())} filters={filters} />
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

