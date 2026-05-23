import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import {
  applyComputedFilters,
  buildStudentWhere,
  computeUrgency,
  parseFilters,
  progressOf,
  sortRows,
  filtersToSearchString,
  type StudentRow,
  type Urgency,
} from "@/lib/students/filters";
import { StudentsFilters } from "./filters";
import { ExportDialog } from "./export-dialog";
import type { BulkRow } from "./bulk-whatsapp-queue";
import { loadBatchSequence } from "@/lib/students/batch-seq";
import { localeForNationality } from "@/lib/messaging/locale-for-nationality";
import { listAllTemplates } from "@/lib/messaging/template-store";
import { StudentsTable } from "./students-table";
import { StudentFormTrigger } from "./student-form-trigger";

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

  const [studentsRaw, batches, batchSeq, templates, formBatchesRaw] = await Promise.all([
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
    listAllTemplates(),
    prisma.batch.findMany({
      where: { status: { in: ["UPCOMING", "ACTIVE"] } },
      orderBy: { startDate: "desc" },
      select: { id: true, code: true, startDate: true, status: true },
    }),
  ]);
  const formBatches = formBatchesRaw.map((b) => ({
    id: b.id,
    label: `${b.code} · starts ${b.startDate.toISOString().slice(0, 10)} · ${b.status.toLowerCase()}`,
  }));

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

  // Status counts for the status segmented strip (independent of payment urgency).
  const statusCounts = {
    ACTIVE: 0,
    PENDING: 0,
    WITHDRAWN: 0,
    COMPLETED: 0,
  };
  for (const r of rows) {
    const s = r.latestEnrollment?.status;
    if (s && s in statusCounts) {
      statusCounts[s as keyof typeof statusCounts] += 1;
    }
  }

  const totalRows = rows.length;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <section className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div
            className="text-xs hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            All students
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <h1
              className="font-display text-4xl font-medium"
              style={{ color: "var(--hz-ink)" }}
            >
              Students
            </h1>
            <span className="hz-mono text-base" style={{ color: "var(--hz-ink-3)" }}>
              {totalRows} total
            </span>
          </div>
          <div
            className="mt-1.5 text-sm hz-mono"
            style={{ color: "var(--hz-ink-2)" }}
          >
            {statusCounts.ACTIVE} active · {statusCounts.PENDING} pending ·{" "}
            {statusCounts.WITHDRAWN} withdrawn · {statusCounts.COMPLETED} completed
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportDialog />
          <StudentFormTrigger mode="create" batches={formBatches} />
        </div>
      </section>

      {/* Search row comes first — easiest to find immediately on first visit. */}
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

      {/* Status + payment segmented strips. Two strips intentionally separate:
          enrollment status (lifecycle) vs payment urgency (do they owe us). */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span
            className="hz-mono text-xs uppercase tracking-[.14em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Enrolment
          </span>
          <div className="seg">
            <StatusSegLink filters={filters} status="">All <span className="ct">{totalRows}</span></StatusSegLink>
            <StatusSegLink filters={filters} status="ACTIVE">Active <span className="ct">{statusCounts.ACTIVE}</span></StatusSegLink>
            <StatusSegLink filters={filters} status="PENDING">Pending <span className="ct">{statusCounts.PENDING}</span></StatusSegLink>
            <StatusSegLink filters={filters} status="WITHDRAWN">Withdrawn <span className="ct">{statusCounts.WITHDRAWN}</span></StatusSegLink>
            <StatusSegLink filters={filters} status="COMPLETED">Completed <span className="ct">{statusCounts.COMPLETED}</span></StatusSegLink>
          </div>
        </div>
        <div className="flex flex-col gap-1 ml-auto">
          <span
            className="hz-mono text-xs uppercase tracking-[.14em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Payment
          </span>
          <div className="seg">
            <UrgencySegLink filters={filters} urgency="paid" color="var(--hz-success)" label="Paid" count={urgencyCounts.paid} />
            <UrgencySegLink filters={filters} urgency="partial" color="var(--hz-warning)" label="Partial" count={urgencyCounts.partial} />
            <UrgencySegLink filters={filters} urgency="due_soon" color="var(--hz-accent)" label="Due soon" count={urgencyCounts.due_soon} />
            <UrgencySegLink filters={filters} urgency="overdue" color="var(--hz-danger)" label="Overdue" count={urgencyCounts.overdue} />
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-12 text-center hz-mono"
          style={{ color: "var(--hz-ink-3)", borderColor: "var(--hz-line)" }}
        >
          No students match these filters.
        </div>
      ) : (
        <StudentsTable
          rows={sorted}
          queueRows={Array.from(queueRows.entries())}
          filters={filters}
          templates={templates}
        />
      )}
    </div>
  );
}

function StatusSegLink({
  filters,
  status,
  children,
}: {
  filters: ReturnType<typeof parseFilters>;
  status: "" | "ACTIVE" | "PENDING" | "WITHDRAWN" | "COMPLETED";
  children: React.ReactNode;
}) {
  const isOn = (filters.enrollmentStatus ?? "") === status;
  const href = `/admin/students${filtersToSearchString(filters, {
    enrollmentStatus: status || null,
  })}`;
  return (
    <Link href={href} className={isOn ? "on" : ""}>
      {children}
    </Link>
  );
}

function UrgencySegLink({
  filters,
  urgency,
  color,
  label,
  count,
}: {
  filters: ReturnType<typeof parseFilters>;
  urgency: "paid" | "partial" | "due_soon" | "overdue";
  color: string;
  label: string;
  count: number;
}) {
  const isOn = filters.urgency === urgency;
  const href = `/admin/students${filtersToSearchString(filters, {
    urgency: isOn ? null : urgency,
  })}`;
  return (
    <Link href={href} className={isOn ? "on" : ""}>
      <span
        className="dot"
        style={{
          background: color,
          boxShadow: urgency === "overdue" ? `0 0 4px ${color}` : undefined,
        }}
      />
      {label} <span className="ct">{count}</span>
    </Link>
  );
}

