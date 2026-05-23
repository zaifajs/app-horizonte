import Link from "next/link";
import { format, startOfToday, differenceInCalendarDays, isBefore } from "date-fns";
import { loadStudentContext } from "@/lib/student/me";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home · Horizonte CRM" };

export default async function StudentHome() {
  const { user, student, currentEnrollment } = await loadStudentContext();

  if (!student || !currentEnrollment) {
    return <EmptyState name={user.name} />;
  }

  const today = startOfToday();
  const batch = currentEnrollment.batch;
  const classroom = batch.sessions
    .filter((s) => s.kind === "CLASSROOM")
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

  // Next session = first SCHEDULED session on/after today.
  const nextSession =
    classroom.find(
      (s) => s.status === "SCHEDULED" && !isBefore(s.scheduledDate, today),
    ) ?? null;

  // Attendance %: count meaningful presence states over sessions that have been
  // marked HELD or are in the past.
  const heldSessions = classroom.filter((s) => s.status === "HELD");
  const attendanceById = new Map(
    currentEnrollment.attendances.map((a) => [a.sessionId, a.state] as const),
  );
  const presentishCount = heldSessions.filter((s) => {
    const st = attendanceById.get(s.id);
    return st === "PRESENT" || st === "LATE" || st === "LEFT_EARLY";
  }).length;
  const attendancePct =
    heldSessions.length === 0
      ? null
      : Math.round((presentishCount / heldSessions.length) * 100);

  // Progress = held / total classroom.
  const progressPct =
    classroom.length === 0
      ? 0
      : Math.round((heldSessions.length / classroom.length) * 100);

  // Tuition.
  const feeCents = batch.course.feeCents;
  const paidCents = currentEnrollment.payments.reduce((a, p) => a + p.amountCents, 0);
  const owedCents = Math.max(0, feeCents - paidCents);
  const fullyPaid = paidCents >= feeCents;

  // Notice (first match wins).
  const notice = pickNotice({
    owedCents,
    docExpiry: student.docExpiry,
    nextSession,
    today,
  });

  return (
    <div className="space-y-6">
      <header>
        <div
          className="hz-mono text-xs uppercase tracking-[.18em]"
          style={{ color: "var(--hz-ink-3)" }}
        >
          {batch.course.code} · Batch {batch.code}
        </div>
        <h1 className="font-display text-3xl font-medium mt-1">
          Hi, <span style={{ color: "var(--hz-primary)" }}>{user.name.split(" ")[0]}</span>.
        </h1>
      </header>

      {notice ? (
        <div
          className="hz-card p-3 flex items-start gap-3"
          style={{
            borderColor: `color-mix(in oklab, ${notice.color} 45%, var(--hz-line))`,
            background: `color-mix(in oklab, ${notice.color} 8%, var(--hz-surface))`,
          }}
        >
          <span
            className="dot mt-1.5"
            style={{ background: notice.color }}
            aria-hidden
          />
          <div className="text-sm">
            <div className="font-medium" style={{ color: notice.color }}>
              {notice.title}
            </div>
            <div className="hz-mono text-xs mt-0.5" style={{ color: "var(--hz-ink-2)" }}>
              {notice.body}
            </div>
          </div>
        </div>
      ) : null}

      <section className="hz-card p-4 space-y-2">
        <h2 className="section-title">Next class</h2>
        {nextSession ? (
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-display text-2xl font-medium">
                {format(nextSession.scheduledDate, "EEEE, dd MMM")}
              </div>
              <div className="hz-mono text-sm mt-1" style={{ color: "var(--hz-ink-2)" }}>
                {nextSession.startTime && nextSession.endTime
                  ? `${nextSession.startTime}–${nextSession.endTime}`
                  : "Time TBC"}
                <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>
                  ·
                </span>
                M{nextSession.module.number} · {nextSession.module.name}
              </div>
              {batch.trainer?.name ? (
                <div className="hz-mono text-xs mt-1" style={{ color: "var(--hz-ink-3)" }}>
                  with {batch.trainer.name}
                </div>
              ) : null}
            </div>
            <Link href="/student/schedule" className="btn-ghost text-sm">
              Full schedule
            </Link>
          </div>
        ) : (
          <p className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
            No upcoming classes scheduled.
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi
          label="Attendance"
          value={attendancePct === null ? "—" : `${attendancePct}%`}
          sub={
            attendancePct === null
              ? "No classes held yet"
              : `${presentishCount} of ${heldSessions.length} classes`
          }
        />
        <Kpi
          label="Course progress"
          value={`${progressPct}%`}
          sub={`${heldSessions.length} of ${classroom.length} classes held`}
          progress={progressPct}
        />
        <Kpi
          label="Tuition"
          value={fullyPaid ? "Paid" : `€${(owedCents / 100).toFixed(2)}`}
          sub={
            fullyPaid
              ? `€${(feeCents / 100).toFixed(2)} fully paid`
              : `of €${(feeCents / 100).toFixed(2)} due`
          }
          tone={fullyPaid ? "success" : owedCents > 0 ? "warning" : undefined}
        />
      </section>
    </div>
  );
}

type NoticeTone = { title: string; body: string; color: string };

function pickNotice({
  owedCents,
  docExpiry,
  nextSession,
  today,
}: {
  owedCents: number;
  docExpiry: Date;
  nextSession: { scheduledDate: Date; startTime: string | null } | null;
  today: Date;
}): NoticeTone | null {
  if (owedCents > 0) {
    return {
      title: `€${(owedCents / 100).toFixed(2)} outstanding`,
      body: "Open the Payments tab to see what's left, or talk to staff.",
      color: "var(--hz-warning)",
    };
  }
  const daysToExpiry = differenceInCalendarDays(docExpiry, today);
  if (daysToExpiry >= 0 && daysToExpiry < 60) {
    return {
      title: `ID document expires ${format(docExpiry, "dd MMM yyyy")}`,
      body: "Bring an updated document to staff before the expiry date.",
      color: "var(--hz-info)",
    };
  }
  if (nextSession) {
    const days = differenceInCalendarDays(nextSession.scheduledDate, today);
    if (days <= 1) {
      const when = days === 0 ? "today" : "tomorrow";
      return {
        title: `Class ${when}${nextSession.startTime ? ` at ${nextSession.startTime}` : ""}`,
        body: "See the schedule tab for the full week.",
        color: "var(--hz-primary)",
      };
    }
  }
  return null;
}

function Kpi({
  label,
  value,
  sub,
  progress,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  progress?: number;
  tone?: "success" | "warning";
}) {
  const valueColor =
    tone === "success"
      ? "var(--hz-success)"
      : tone === "warning"
        ? "var(--hz-warning)"
        : "var(--hz-ink)";
  return (
    <div className="hz-card p-4 space-y-2">
      <div className="section-title">{label}</div>
      <div className="font-display text-2xl font-medium" style={{ color: valueColor }}>
        {value}
      </div>
      <div className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
        {sub}
      </div>
      {progress !== undefined ? (
        <div
          style={{
            height: 3,
            background: "var(--hz-line)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              display: "block",
              height: "100%",
              width: `${progress}%`,
              background: "var(--hz-primary)",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ name }: { name: string }) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-3xl font-medium">
          Hi, <span style={{ color: "var(--hz-primary)" }}>{name.split(" ")[0]}</span>.
        </h1>
      </header>
      <div className="hz-card p-6 space-y-2">
        <p className="hz-mono text-sm" style={{ color: "var(--hz-ink-2)" }}>
          Your enrolment hasn&apos;t been activated yet.
        </p>
        <p className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
          We&apos;ll email you as soon as your batch is set. If this looks wrong,
          please reach out to staff.
        </p>
      </div>
    </div>
  );
}
