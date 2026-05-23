import Link from "next/link";
import { format, addDays, startOfToday } from "date-fns";
import { prisma } from "@/lib/db";
import {
  computeUrgency,
  PAYMENT_DEADLINE_DAYS,
} from "@/lib/students/filters";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export const metadata = { title: "Today · Horizonte CRM" };

const dayMs = 86_400_000;

function diffDays(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / dayMs);
}

type AuditEntry = {
  entityType: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  actorName: string | null;
  changes: unknown;
};

function describeAudit(a: AuditEntry): { label: string; tone: string; body: string } {
  const actor = a.actorName ?? "system";
  const map: Record<string, { label: string; tone: string }> = {
    Payment: { label: "Payment", tone: "var(--hz-primary)" },
    Attendance: { label: "Attendance", tone: "var(--hz-success)" },
    Enrollment: { label: "Enrollment", tone: "var(--hz-info)" },
    Batch: { label: "Batch", tone: "var(--hz-warning)" },
    BatchSession: { label: "Session", tone: "var(--hz-warning)" },
    Student: { label: "Student", tone: "var(--hz-ink-2)" },
    User: { label: "User", tone: "var(--hz-accent)" },
  };
  const meta = map[a.entityType] ?? { label: a.entityType, tone: "var(--hz-ink-2)" };
  const verb =
    a.action === "CREATE" ? "added" : a.action === "UPDATE" ? "changed" : "removed";
  return { label: meta.label, tone: meta.tone, body: `${verb} by ${actor}` };
}

export default async function TodayPage() {
  const today = startOfToday();
  const docExpiryWindow = addDays(today, 60);

  const oneWeekAgo = addDays(today, -7);

  const [
    enrollments,
    activeStudentCount,
    newActiveLastWeek,
    batches,
    expiringStudents,
    recentAudit,
    nextSession,
  ] = await Promise.all([
    prisma.enrollment.findMany({
      where: { status: { in: ["PENDING", "ACTIVE"] } },
      include: {
        student: { select: { id: true, fullName: true, phone: true } },
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
    }),
    prisma.enrollment.count({ where: { status: "ACTIVE" } }),
    prisma.enrollment.count({
      where: { status: "ACTIVE", enrolledAt: { gte: oneWeekAgo } },
    }),
    prisma.batch.findMany({
      where: { status: { notIn: ["FINISHED", "CANCELLED"] } },
      select: { id: true, code: true, status: true, startDate: true },
      orderBy: { startDate: "asc" },
    }),
    prisma.student.findMany({
      where: { docExpiry: { lte: docExpiryWindow, gte: today } },
      select: { id: true, fullName: true, docType: true, docExpiry: true },
      orderBy: { docExpiry: "asc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    }),
    prisma.batchSession.findFirst({
      where: { kind: "CLASSROOM", scheduledDate: { gte: today }, status: "SCHEDULED" },
      orderBy: [{ scheduledDate: "asc" }, { startTime: "asc" }],
      include: {
        batch: {
          select: {
            code: true,
            trainer: { select: { name: true } },
          },
        },
        module: { select: { number: true } },
      },
    }),
  ]);

  const rows = enrollments.map((e) => {
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
      daysSinceEnrolled: diffDays(e.enrolledAt, today),
      enrolledAt: e.enrolledAt,
    };
  });

  const overdue = rows
    .filter((r) => r.urgency.urgency === "overdue")
    .sort((a, b) => (a.urgency.daysToDeadline ?? 0) - (b.urgency.daysToDeadline ?? 0));

  const dueSoon = rows.filter((r) => r.urgency.urgency === "due_soon");

  const pendingNew = rows
    .filter(
      (r) => r.urgency.urgency === "pre_start" && r.daysSinceEnrolled <= 14 && r.paid === 0,
    )
    .sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime());

  const pendingPaymentsCents = rows
    .filter((r) => r.due > 0)
    .reduce((a, r) => a + r.due, 0);
  const pendingPaymentsStudentCount = rows.filter((r) => r.due > 0).length;

  const overdueTotalCents = overdue.reduce((a, r) => a + r.due, 0);
  const oldestOverdueDays = overdue[0]?.urgency.daysToDeadline
    ? Math.abs(overdue[0].urgency.daysToDeadline)
    : 0;

  // A batch is treated as "running" if its start date has passed, regardless
  // of whether someone has flipped Batch.status from UPCOMING to ACTIVE.
  const activeBatches = batches.filter((b) => b.startDate <= today);
  const upcomingBatches = batches.filter((b) => b.startDate > today);

  const now = new Date();
  const partOfDay = (() => {
    const h = now.getHours();
    if (h < 12) return "morning";
    if (h < 18) return "afternoon";
    return "evening";
  })();

  // Earliest active cohort detail for the descriptive header subline.
  const earliestActive = activeBatches[0];
  const nextSessionTime = nextSession?.startTime ?? null;
  const nextSessionTrainer = nextSession?.batch.trainer?.name ?? null;
  const totalBatchSlots = activeBatches.length + upcomingBatches.length;
  const totalBatches = totalBatchSlots || 0;

  return (
    <div className="space-y-6">
      {/* ============ HEADER STRIP ============ */}
      <section className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div
            className="text-sm hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            {format(now, "EEEE")} {partOfDay} · {format(now, "HH:mm")}
          </div>
          <h1
            className="font-display text-5xl leading-[1.05] font-medium mt-1.5"
            style={{ color: "var(--hz-ink)" }}
          >
            <span style={{ color: "var(--hz-danger)" }}>{overdue.length}</span>{" "}
            <span style={{ color: "var(--hz-ink-2)", fontWeight: 400 }}>overdue</span>
            <span style={{ color: "var(--hz-ink-3)" }}>,</span>{" "}
            <span style={{ color: "var(--hz-warning)" }}>{dueSoon.length}</span>{" "}
            <span style={{ color: "var(--hz-ink-2)", fontWeight: 400 }}>due soon</span>
            <span style={{ color: "var(--hz-ink-3)" }}>,</span>{" "}
            <span style={{ color: "var(--hz-info)" }}>{pendingNew.length}</span>{" "}
            <span style={{ color: "var(--hz-ink-2)", fontWeight: 400 }}>to enroll</span>
            <span style={{ color: "var(--hz-ink-3)" }}>.</span>
          </h1>
          <p className="mt-2 text-base hz-mono" style={{ color: "var(--hz-ink-2)" }}>
            {overdue.length > 0 ? (
              <>
                {overdue.length} overdue
                {oldestOverdueDays > 0 ? ` past ${oldestOverdueDays} days` : null}
              </>
            ) : (
              "Nothing overdue"
            )}
            {earliestActive ? (
              <>
                {" · current batch "}
                <span style={{ color: "var(--hz-primary)" }}>{earliestActive.code}</span>
              </>
            ) : null}
            {nextSessionTime ? (
              <>
                {" · next class "}
                {nextSessionTime}
                {nextSessionTrainer ? ` with ${nextSessionTrainer}` : null}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" className="btn-ghost">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            Weekly report
          </button>
          <Link href="/admin/students/new" className="btn-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Enroll student
          </Link>
        </div>
      </section>

      {/* ============ STATS GRID ============ */}
      <section className="hz-card overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 grid-cells">
          <div>
            <div className="text-sm hz-mono uppercase tracking-[.16em]" style={{ color: "var(--hz-ink-3)" }}>
              Active students
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="stat-num text-5xl" style={{ color: "var(--hz-ink)" }}>
                {activeStudentCount}
              </span>
              {newActiveLastWeek > 0 ? (
                <span className="chip chip-success">↑ +{newActiveLastWeek} this week</span>
              ) : null}
            </div>
            <div className="mt-1 text-sm hz-mono" style={{ color: "var(--hz-ink-3)" }}>
              across {activeBatches.length} {activeBatches.length === 1 ? "batch" : "batches"}
            </div>
          </div>
          <div>
            <div className="text-sm hz-mono uppercase tracking-[.16em]" style={{ color: "var(--hz-ink-3)" }}>
              Active batches
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="stat-num text-5xl" style={{ color: "var(--hz-ink)" }}>
                {activeBatches.length}
              </span>
              {totalBatches > 0 ? (
                <span className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
                  of {totalBatches} total
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex items-center gap-1 text-sm hz-mono flex-wrap">
              {activeBatches.slice(0, 4).map((b) => (
                <span key={b.id} className="px-1.5 py-0.5 rounded-sm chip-success">
                  {b.code}
                </span>
              ))}
              {upcomingBatches.slice(0, 4).map((b) => (
                <span key={b.id} className="px-1.5 py-0.5 rounded-sm chip-warning">
                  {b.code}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm hz-mono uppercase tracking-[.16em]" style={{ color: "var(--hz-ink-3)" }}>
              Pending payments
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="hz-mono text-xl" style={{ color: "var(--hz-ink-3)" }}>
                €
              </span>
              <span className="stat-num text-5xl" style={{ color: "var(--hz-ink)" }}>
                {(pendingPaymentsCents / 100).toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="mt-1 text-sm hz-mono" style={{ color: "var(--hz-ink-3)" }}>
              {pendingPaymentsStudentCount} {pendingPaymentsStudentCount === 1 ? "student owes" : "students owe"}
            </div>
          </div>
          <div style={overdue.length > 0 ? { background: "var(--hz-danger-50)" } : undefined}>
            <div
              className="text-sm hz-mono uppercase tracking-[.16em]"
              style={{ color: overdue.length > 0 ? "var(--hz-danger)" : "var(--hz-ink-3)" }}
            >
              Overdue
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className="stat-num text-5xl"
                style={{ color: overdue.length > 0 ? "var(--hz-danger)" : "var(--hz-ink)" }}
              >
                {overdue.length}
              </span>
              {overdue.length > 0 ? <span className="chip chip-danger">!</span> : null}
            </div>
            <div className="mt-1 text-sm hz-mono" style={{ color: "var(--hz-ink-2)" }}>
              {oldestOverdueDays > 0
                ? `Oldest ${oldestOverdueDays} ${oldestOverdueDays === 1 ? "day" : "days"}`
                : "All paid"}
            </div>
          </div>
        </div>
      </section>

      {/* ============ MAIN GRID ============ */}
      <div className="grid gap-5 grid-cols-1 lg:[grid-template-columns:minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* OVERDUE TABLE */}
        <section className="hz-card overflow-hidden">
          <header className="px-4 py-3 hair-b flex items-center gap-3" style={{ background: "var(--hz-surface-2)" }}>
            <span className="status-pill" style={{ color: "var(--hz-danger)" }}>
              <span className="dot" style={{ background: "var(--hz-danger)" }} />
              Overdue payments
            </span>
            <span className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
              {overdue.length} {overdue.length === 1 ? "student" : "students"} · €
              {(overdueTotalCents / 100).toLocaleString("en-US")} owed
            </span>
            <Link
              href="/admin/students?urgency=overdue"
              className="ml-auto btn-ghost text-sm"
              style={{ padding: "5px 9px" }}
            >
              View all
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </header>

          {overdue.length === 0 ? (
            <div className="px-4 py-10 text-center text-base hz-mono" style={{ color: "var(--hz-ink-3)" }}>
              No overdue payments. Nice.
            </div>
          ) : (
            <>
              <div
                className="grid grid-cols-12 gap-3 px-4 py-2 hair-b text-sm hz-mono uppercase tracking-[.14em]"
                style={{ color: "var(--hz-ink-3)" }}
              >
                <div className="col-span-5">student</div>
                <div className="col-span-2">batch</div>
                <div className="col-span-2">amount</div>
                <div className="col-span-2">days late</div>
                <div className="col-span-1 text-right">actions</div>
              </div>
              <ul>
                {overdue.slice(0, 8).map((r, i) => {
                  const days = Math.abs(r.urgency.daysToDeadline ?? 0);
                  const railOpacity = Math.max(0.4, 1 - i * 0.15);
                  const installmentLabel =
                    r.paid === 0
                      ? "Full fee"
                      : r.due === r.fee / 2
                        ? "2nd installment"
                        : "Balance due";
                  const cleanPhone = (r.studentPhone || "").replace(/\D+/g, "");
                  return (
                    <li
                      key={r.studentId}
                      className="grid grid-cols-12 gap-3 px-4 py-3 hair-b items-center row-hover"
                    >
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        <div className="rail" style={{ background: "var(--hz-danger)", opacity: railOpacity }} />
                        <Avatar name={r.studentName} />
                        <Link
                          href={`/admin/students/${r.studentId}`}
                          className="min-w-0"
                        >
                          <div className="font-semibold text-base truncate" style={{ color: "var(--hz-ink)" }}>
                            {r.studentName}
                          </div>
                          <div className="text-sm hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                            {installmentLabel} · invoiced {format(r.deadlineDate, "yyyy-MM-dd")}
                          </div>
                        </Link>
                      </div>
                      <div className="col-span-2 hz-mono text-base" style={{ color: "var(--hz-primary)" }}>
                        {r.batchCode}
                      </div>
                      <div className="col-span-2 hz-mono font-semibold text-lg" style={{ color: "var(--hz-ink)" }}>
                        €{(r.due / 100).toFixed(2)}
                      </div>
                      <div className="col-span-2">
                        <div className="status-pill" style={{ color: "var(--hz-danger)" }}>
                          <span className="dot" style={{ background: "var(--hz-danger)" }} />
                          +{days}d
                        </div>
                      </div>
                      <div className="col-span-1 flex items-center justify-end gap-1">
                        {cleanPhone ? (
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ibtn"
                            title="Send WhatsApp"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                          </a>
                        ) : null}
                        <Link
                          href={`/admin/students/${r.studentId}`}
                          className="ibtn"
                          title="Record payment"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="5" width="20" height="14" rx="2" />
                            <path d="M2 10h20" />
                          </svg>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <footer
                className="px-4 py-2.5 hair-t flex items-center justify-between gap-3"
                style={{ background: "var(--hz-surface-2)" }}
              >
                <div className="text-sm hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                  {overdue.length > 8 ? (
                    <>
                      Showing top 8 of {overdue.length}.{" "}
                      <Link href="/admin/students?urgency=overdue" className="underline">
                        See all
                      </Link>
                    </>
                  ) : (
                    "Tip: select multiple rows in Students to send reminders in batch."
                  )}
                </div>
                <Link
                  href="/admin/students?urgency=overdue"
                  className="btn-primary text-sm"
                  style={{ padding: "5px 10px" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  Remind all {overdue.length}
                </Link>
              </footer>
            </>
          )}
        </section>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-5">
          {/* DOC EXPIRY */}
          <section className="hz-card overflow-hidden">
            <header className="px-4 py-3 hair-b flex items-center gap-3" style={{ background: "var(--hz-surface-2)" }}>
              <span className="status-pill" style={{ color: "var(--hz-warning)" }}>
                <span className="dot" style={{ background: "var(--hz-warning)" }} />
                Documents expiring
              </span>
              <span className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
                Within 60 days · {expiringStudents.length}{" "}
                {expiringStudents.length === 1 ? "student" : "students"}
              </span>
            </header>
            {expiringStudents.length === 0 ? (
              <div className="px-4 py-6 text-center text-base hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                No documents expiring soon.
              </div>
            ) : (
              <ul>
                {expiringStudents.map((s, i) => {
                  const days = diffDays(today, s.docExpiry);
                  const opacity = Math.max(0.4, 1 - i * 0.2);
                  const color = days <= 30 ? "var(--hz-warning)" : "var(--hz-ink-2)";
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center gap-3 px-4 py-3 row-hover ${i < expiringStudents.length - 1 ? "hair-b" : ""}`}
                    >
                      <div className="rail" style={{ background: "var(--hz-warning)", opacity }} />
                      <Avatar name={s.fullName} />
                      <Link href={`/admin/students/${s.id}`} className="flex-1 min-w-0">
                        <div className="font-semibold text-base truncate" style={{ color: "var(--hz-ink)" }}>
                          {s.fullName}
                        </div>
                        <div className="text-sm mt-0.5 hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                          {s.docType.toLowerCase().replace("_", " ")} · expires{" "}
                          {format(s.docExpiry, "yyyy-MM-dd")}
                        </div>
                      </Link>
                      <div className="text-right">
                        <div className="status-pill" style={{ color }}>
                          +{days}d
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* PENDING ENROLLMENTS */}
          <section className="hz-card overflow-hidden">
            <header className="px-4 py-3 hair-b flex items-center gap-3" style={{ background: "var(--hz-surface-2)" }}>
              <span className="status-pill" style={{ color: "var(--hz-info)" }}>
                <span className="dot" style={{ background: "var(--hz-info)" }} />
                Pending enrollments
              </span>
              <span className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
                No payment yet · {pendingNew.length}{" "}
                {pendingNew.length === 1 ? "student" : "students"}
              </span>
            </header>
            {pendingNew.length === 0 ? (
              <div className="px-4 py-6 text-center text-base hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                No fresh registrations awaiting first payment.
              </div>
            ) : (
              <ul>
                {pendingNew.slice(0, 5).map((r, i) => {
                  const opacity = Math.max(0.4, 1 - i * 0.18);
                  return (
                    <li
                      key={r.studentId}
                      className={`flex items-center gap-3 px-4 py-3 row-hover ${i < Math.min(5, pendingNew.length) - 1 ? "hair-b" : ""}`}
                    >
                      <div className="rail" style={{ background: "var(--hz-info)", opacity }} />
                      <Avatar name={r.studentName} />
                      <Link href={`/admin/students/${r.studentId}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base truncate" style={{ color: "var(--hz-ink)" }}>
                            {r.studentName}
                          </span>
                          <span className="chip chip-primary">{r.batchCode}</span>
                        </div>
                        <div className="text-sm mt-0.5 hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                          enrolled {format(r.enrolledAt, "yyyy-MM-dd")} · awaiting €
                          {(r.fee / 100).toFixed(0)}
                        </div>
                      </Link>
                      <div className="text-right">
                        <div className="status-pill" style={{ color: "var(--hz-info)" }}>
                          +{r.daysSinceEnrolled}d
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ACTIVITY LOG */}
          {recentAudit.length > 0 ? (
            <section className="hz-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="status-pill" style={{ color: "var(--hz-ink-2)" }}>
                  <span
                    className="dot hz-pulse"
                    style={{ background: "var(--hz-success)", boxShadow: "0 0 6px var(--hz-success)" }}
                  />
                  Activity · live
                </span>
                <span className="ml-auto text-sm hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                  last 24h
                </span>
              </div>
              <ul className="space-y-1.5 text-sm hz-mono" style={{ color: "var(--hz-ink-2)" }}>
                {recentAudit.slice(0, 6).map((a) => {
                  const sameDay = diffDays(a.createdAt, today) === 0;
                  const stamp = sameDay
                    ? format(a.createdAt, "HH:mm")
                    : diffDays(a.createdAt, today) === 1
                      ? "Yest."
                      : `-${diffDays(a.createdAt, today)}d`;
                  const desc = describeAudit({
                    entityType: a.entityType,
                    action: a.action,
                    actorName: a.actor?.name ?? null,
                    changes: a.changes,
                  });
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span style={{ color: "var(--hz-ink-3)", minWidth: 44 }}>{stamp}</span>
                      <span>
                        <span style={{ color: desc.tone }}>{desc.label}</span>
                        <span style={{ color: "var(--hz-ink-3)" }}> · {desc.body}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
