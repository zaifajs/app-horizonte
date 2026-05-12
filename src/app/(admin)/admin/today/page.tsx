import Link from "next/link";
import { format, addDays, startOfToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import {
  computeUrgency,
  PAYMENT_DEADLINE_DAYS,
} from "@/lib/students/filters";

export const dynamic = "force-dynamic";

export const metadata = { title: "Today · Horizonte CRM" };

export default async function TodayPage() {
  const today = startOfToday();
  const inSevenDays = addDays(today, 7);

  // Pull enrollments that need attention: PENDING (no payment yet) or
  // ACTIVE-with-balance, plus a recently-registered slice.
  const enrollments = await prisma.enrollment.findMany({
    where: { status: { in: ["PENDING", "ACTIVE"] } },
    include: {
      student: { select: { id: true, fullName: true, phone: true, nationality: true } },
      batch: {
        select: {
          id: true,
          code: true,
          startDate: true,
          status: true,
          course: { select: { feeCents: true } },
        },
      },
      payments: { select: { amountCents: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  // Enrich each with paid/due/urgency.
  type Row = {
    studentId: string;
    studentName: string;
    studentPhone: string;
    batchCode: string;
    batchId: string;
    paid: number;
    fee: number;
    due: number;
    urgency: ReturnType<typeof computeUrgency>;
    deadlineDate: Date | null;
    daysUntilStart: number | null;
    daysSinceEnrolled: number;
    enrolledAt: Date;
  };

  const rows: Row[] = enrollments.map((e) => {
    const paid = e.payments.reduce((a, p) => a + p.amountCents, 0);
    const fee = e.batch.course.feeCents;
    const due = Math.max(0, fee - paid);
    const urgency = computeUrgency({
      enrollmentStatus: e.status,
      batchStartDate: e.batch.startDate,
      paidCents: paid,
      feeCents: fee,
      today,
    });
    const deadlineDate = new Date(e.batch.startDate);
    deadlineDate.setUTCDate(deadlineDate.getUTCDate() + PAYMENT_DEADLINE_DAYS);
    const dayMs = 86_400_000;
    const startMs = Date.UTC(
      e.batch.startDate.getUTCFullYear(),
      e.batch.startDate.getUTCMonth(),
      e.batch.startDate.getUTCDate(),
    );
    const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const daysUntilStart = Math.round((startMs - todayMs) / dayMs);
    const daysSinceEnrolled = Math.round(
      (todayMs - e.enrolledAt.getTime()) / dayMs,
    );
    return {
      studentId: e.student.id,
      studentName: e.student.fullName,
      studentPhone: e.student.phone,
      batchCode: e.batch.code,
      batchId: e.batch.id,
      paid,
      fee,
      due,
      urgency,
      deadlineDate,
      daysUntilStart,
      daysSinceEnrolled,
      enrolledAt: e.enrolledAt,
    };
  });

  const overdue = rows
    .filter((r) => r.urgency.urgency === "overdue")
    .sort((a, b) => (a.urgency.daysToDeadline ?? 0) - (b.urgency.daysToDeadline ?? 0));

  const dueSoon = rows
    .filter((r) => r.urgency.urgency === "due_soon")
    .sort((a, b) => (a.urgency.daysToDeadline ?? 0) - (b.urgency.daysToDeadline ?? 0));

  const newPending = rows
    .filter((r) => r.urgency.urgency === "pre_start" && r.daysSinceEnrolled <= 14 && r.paid === 0)
    .sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime());

  // Today's classroom sessions to remind staff.
  const sessions = await prisma.batchSession.findMany({
    where: {
      kind: "CLASSROOM",
      scheduledDate: today,
    },
    orderBy: { startTime: "asc" },
    include: {
      batch: { select: { code: true, id: true } },
      module: { select: { number: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-zinc-50 to-white p-5">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Today
        </h1>
        <p className="text-sm text-muted-foreground">
          {format(today, "EEEE, dd MMM yyyy")}
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Overdue"          value={overdue.length}    cls="bg-red-100 border-red-300 text-red-900" />
          <Stat label="Due soon"         value={dueSoon.length}    cls="bg-orange-100 border-orange-300 text-orange-900" />
          <Stat label="New registrations" value={newPending.length} cls="bg-stone-100 border-stone-300 text-stone-900" />
          <Stat label="Sessions today"   value={sessions.length}    cls="bg-zinc-900 border-zinc-900 text-white" />
        </div>
      </div>

      {sessions.length > 0 ? (
        <Section title="Sessions today">
          <ul className="space-y-1.5">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/batches/${s.batch.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-white p-3 hover:border-foreground/30"
                >
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Batch {s.batch.code} · M{s.module.number} · {s.module.name}
                    </div>
                    <div className="font-medium">
                      {s.startTime}–{s.endTime}
                    </div>
                  </div>
                  <Badge variant="outline">{s.status.toLowerCase()}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section
        title={`Overdue · ${overdue.length}`}
        emptyText="No overdue payments. Nice."
        rows={overdue}
        tint="red"
      />
      <Section
        title={`Due soon · ${dueSoon.length}`}
        emptyText="Nothing approaching the 4-week deadline."
        rows={dueSoon}
        tint="orange"
      />
      <Section
        title={`New registrations · ${newPending.length}`}
        emptyText="No fresh registrations awaiting first payment."
        rows={newPending}
        tint="stone"
      />
    </div>
  );
}

function Stat({
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
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

type SectionRow = {
  studentId: string;
  studentName: string;
  batchCode: string;
  due: number;
  fee: number;
  urgency: ReturnType<typeof computeUrgency>;
  enrolledAt: Date;
  daysSinceEnrolled: number;
  daysUntilStart: number | null;
};

function Section({
  title,
  rows,
  emptyText,
  tint,
  children,
}: {
  title: string;
  rows?: SectionRow[];
  emptyText?: string;
  tint?: "red" | "orange" | "stone";
  children?: React.ReactNode;
}) {
  if (children) {
    return (
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          {title}
        </h2>
        {children}
      </section>
    );
  }
  if (!rows) return null;
  if (rows.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          {title}
        </h2>
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {emptyText ?? "—"}
        </div>
      </section>
    );
  }
  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
        {title}
      </h2>
      <ul className="space-y-1.5">
        {rows.slice(0, 25).map((r) => (
          <li key={r.studentId}>
            <Link
              href={`/admin/students/${r.studentId}`}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 hover:border-foreground/30 bg-white`}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{r.studentName}</div>
                <div className="text-xs text-muted-foreground">
                  Batch {r.batchCode} ·{" "}
                  {tint === "red"
                    ? `${Math.abs(r.urgency.daysToDeadline ?? 0)} days overdue`
                    : tint === "orange"
                      ? `${r.urgency.daysToDeadline ?? 0} days to deadline`
                      : r.daysUntilStart != null
                        ? `Starts in ${r.daysUntilStart} days`
                        : ""}
                </div>
              </div>
              <div className="text-right text-sm shrink-0">
                <div className="text-amber-700 font-medium tabular-nums">
                  €{(r.due / 100).toFixed(2)} due
                </div>
                <div className="text-xs text-muted-foreground">
                  of €{(r.fee / 100).toFixed(2)}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > 25 ? (
        <p className="text-xs text-muted-foreground">
          Showing top 25 of {rows.length}.{" "}
          <Link href={
            tint === "red"
              ? "/admin/students?urgency=overdue"
              : tint === "orange"
                ? "/admin/students?urgency=due_soon"
                : "/admin/students?status=PENDING"
          } className="underline">
            See all
          </Link>
        </p>
      ) : null}
    </section>
  );
}
