import { format, startOfISOWeek, isSameDay, isBefore, startOfToday } from "date-fns";
import { loadStudentContext } from "@/lib/student/me";

export const dynamic = "force-dynamic";

export const metadata = { title: "Schedule · Horizonte CRM" };

type AttendanceLabel = {
  label: string;
  className: "chip-success" | "chip-warning" | "chip-info" | "chip-danger" | "chip-muted";
};

const ATTENDANCE_MAP: Record<string, AttendanceLabel> = {
  PRESENT: { label: "Present", className: "chip-success" },
  LATE: { label: "Late", className: "chip-warning" },
  LEFT_EARLY: { label: "Left early", className: "chip-warning" },
  EXCUSED_ABSENCE: { label: "Excused", className: "chip-info" },
  UNEXCUSED_ABSENCE: { label: "Absent", className: "chip-danger" },
};

const SESSION_STATUS: Record<
  string,
  { label: string; className: string; strike?: boolean }
> = {
  HELD: { label: "Held", className: "chip-success" },
  SCHEDULED: { label: "Upcoming", className: "chip-outline" },
  CANCELLED: { label: "Cancelled", className: "chip-muted", strike: true },
  RESCHEDULED: { label: "Rescheduled", className: "chip-muted" },
};

export default async function StudentSchedulePage() {
  const { student, currentEnrollment } = await loadStudentContext();

  if (!student || !currentEnrollment) {
    return (
      <div className="hz-card p-6">
        <p className="hz-mono text-sm" style={{ color: "var(--hz-ink-2)" }}>
          You&apos;re not enrolled in a batch yet. The schedule will appear here
          once staff places you in one.
        </p>
      </div>
    );
  }

  const today = startOfToday();
  const batch = currentEnrollment.batch;
  const sessions = batch.sessions
    .filter((s) => s.kind === "CLASSROOM")
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

  const attendanceById = new Map(
    currentEnrollment.attendances.map((a) => [a.sessionId, a.state] as const),
  );

  // Group by ISO week.
  const weeks = new Map<string, { weekStart: Date; rows: typeof sessions }>();
  for (const s of sessions) {
    const ws = startOfISOWeek(s.scheduledDate);
    const key = ws.toISOString();
    if (!weeks.has(key)) weeks.set(key, { weekStart: ws, rows: [] });
    weeks.get(key)!.rows.push(s);
  }

  return (
    <div className="space-y-5">
      <header>
        <div
          className="hz-mono text-xs uppercase tracking-[.18em]"
          style={{ color: "var(--hz-ink-3)" }}
        >
          {batch.course.code} · Batch {batch.code}
        </div>
        <h1 className="font-display text-2xl font-medium mt-1">Schedule</h1>
        <p className="hz-mono text-xs mt-1" style={{ color: "var(--hz-ink-3)" }}>
          {sessions.length} classroom sessions
          {batch.trainer?.name ? ` · with ${batch.trainer.name}` : ""}
        </p>
      </header>

      {Array.from(weeks.values()).map((wk) => (
        <section key={wk.weekStart.toISOString()} className="space-y-2">
          <h2 className="section-title">Week of {format(wk.weekStart, "dd MMM yyyy")}</h2>
          <ul className="hz-card divide-y" style={{ borderColor: "var(--hz-line)" }}>
            {wk.rows.map((s) => {
              const isToday = isSameDay(s.scheduledDate, today);
              const isPast = isBefore(s.scheduledDate, today);
              const statusKey =
                s.status === "SCHEDULED" && isToday ? "TODAY" : s.status;
              const statusMeta =
                statusKey === "TODAY"
                  ? { label: "Today", className: "chip-primary" as const }
                  : SESSION_STATUS[s.status] ?? SESSION_STATUS.SCHEDULED;

              const attState = attendanceById.get(s.id);
              const attMeta = attState ? ATTENDANCE_MAP[attState] : null;
              // Only show a "—" attendance placeholder for sessions that should
              // have been marked (held / past). Upcoming rows leave it blank.
              const showAttPlaceholder = !attMeta && (s.status === "HELD" || isPast);

              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 p-3 flex-wrap"
                  style={{ borderColor: "var(--hz-line)" }}
                >
                  <div className="min-w-[110px]">
                    <div
                      className="hz-mono text-sm font-semibold"
                      style={{
                        color: isToday ? "var(--hz-primary)" : "var(--hz-ink)",
                        textDecoration:
                          s.status === "CANCELLED" ? "line-through" : "none",
                      }}
                    >
                      {format(s.scheduledDate, "EEE dd MMM")}
                    </div>
                    <div className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
                      {s.startTime && s.endTime
                        ? `${s.startTime}–${s.endTime}`
                        : "Time TBC"}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span
                        className="hz-mono text-xs"
                        style={{ color: "var(--hz-ink-3)" }}
                      >
                        M{s.module.number}
                      </span>
                      <span className="ml-2">{s.module.name}</span>
                    </div>
                  </div>

                  <span className={`chip ${statusMeta.className}`}>{statusMeta.label}</span>

                  {attMeta ? (
                    <span className={`chip ${attMeta.className}`}>{attMeta.label}</span>
                  ) : showAttPlaceholder ? (
                    <span className="chip chip-outline">—</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
