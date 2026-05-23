import Link from "next/link";
import { format, isSameDay, startOfToday, differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Teacher · Horizonte CRM" };

export default async function TeacherHome() {
  const user = await requireRole(["TEACHER"]);
  const today = startOfToday();

  const batches = await prisma.batch.findMany({
    where: { trainerId: user.id, status: { in: ["UPCOMING", "ACTIVE", "FINISHED"] } },
    orderBy: [{ startDate: "desc" }],
    include: {
      course: { select: { code: true, name: true } },
      sessions: {
        where: { kind: "CLASSROOM" },
        orderBy: { scheduledDate: "asc" },
        select: {
          id: true,
          scheduledDate: true,
          startTime: true,
          endTime: true,
          status: true,
          module: { select: { number: true, name: true } },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });

  type TodaySession = {
    batchCode: string;
    batchId: string;
    sessionId: string;
    startTime: string | null;
    endTime: string | null;
    enrolledCount: number;
    moduleNumber: number;
    moduleName: string;
  };
  const todaysSessions: TodaySession[] = [];
  // For the empty-state ("no session today") we surface the soonest future
  // scheduled session so the teacher has orientation instead of a blank space.
  let nextSession:
    | {
        batchCode: string;
        batchId: string;
        sessionId: string;
        date: Date;
        startTime: string | null;
        moduleNumber: number;
        moduleName: string;
      }
    | null = null;
  for (const b of batches) {
    for (const s of b.sessions) {
      if (isSameDay(s.scheduledDate, today)) {
        todaysSessions.push({
          batchCode: b.code,
          batchId: b.id,
          sessionId: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          enrolledCount: b._count.enrollments,
          moduleNumber: s.module.number,
          moduleName: s.module.name,
        });
      } else if (
        s.scheduledDate > today &&
        s.status === "SCHEDULED" &&
        (!nextSession || s.scheduledDate < nextSession.date)
      ) {
        nextSession = {
          batchCode: b.code,
          batchId: b.id,
          sessionId: s.id,
          date: s.scheduledDate,
          startTime: s.startTime,
          moduleNumber: s.module.number,
          moduleName: s.module.name,
        };
      }
    }
  }

  const runtimeStatus = (b: (typeof batches)[number]): "ACTIVE" | "UPCOMING" | "FINISHED" => {
    if (b.status === "FINISHED" || b.status === "CANCELLED") return "FINISHED";
    if (b.startDate <= today) return "ACTIVE";
    return "UPCOMING";
  };

  const active = batches.filter((b) => runtimeStatus(b) === "ACTIVE");
  const upcoming = batches.filter((b) => runtimeStatus(b) === "UPCOMING");
  const finished = batches.filter((b) => runtimeStatus(b) === "FINISHED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <section>
        <div
          className="text-sm hz-mono uppercase tracking-[.18em]"
          style={{ color: "var(--hz-ink-3)" }}
        >
          {format(today, "EEEE")} · {format(today, "yyyy-MM-dd")}
        </div>
        <h1
          className="font-display text-4xl font-medium mt-1"
          style={{ color: "var(--hz-ink)" }}
        >
          Hi, <span style={{ color: "var(--hz-primary)" }}>{user.name.split(" ")[0]}</span>.
        </h1>
        <p className="mt-1.5 text-sm hz-mono" style={{ color: "var(--hz-ink-2)" }}>
          {active.length} active · {upcoming.length} upcoming · {finished.length} finished
        </p>
      </section>

      {/* Today's sessions OR next-up fallback */}
      {todaysSessions.length === 0 && nextSession ? (
        <section className="space-y-2">
          <h2 className="section-title">Up next</h2>
          <Link
            href={`/teacher/sessions/${nextSession.sessionId}`}
            className="hz-card overflow-hidden block"
          >
            <div className="flex items-stretch">
              <div
                className="flex flex-col items-center justify-center px-5"
                style={{
                  background: "var(--hz-surface-2)",
                  color: "var(--hz-ink-2)",
                  minWidth: 110,
                  borderRight: "1px solid var(--hz-line)",
                }}
              >
                <span className="text-xs hz-mono uppercase tracking-[.16em]">
                  {format(nextSession.date, "MMM")}
                </span>
                <span className="font-display text-3xl font-medium leading-none mt-1">
                  {format(nextSession.date, "dd")}
                </span>
                <span className="text-xs hz-mono uppercase">
                  {format(nextSession.date, "EEE")}
                </span>
              </div>
              <div className="flex-1 p-4 flex items-center gap-4 flex-wrap">
                <div className="min-w-0">
                  <div
                    className="text-xs hz-mono uppercase tracking-[.16em]"
                    style={{ color: "var(--hz-ink-3)" }}
                  >
                    Next session ·{" "}
                    {(() => {
                      const d = differenceInCalendarDays(nextSession.date, today);
                      return d === 1 ? "tomorrow" : `in ${d} days`;
                    })()}
                  </div>
                  <div className="mt-1 font-display text-lg font-medium">
                    Batch {nextSession.batchCode} · M{nextSession.moduleNumber} · {nextSession.moduleName}
                  </div>
                  {nextSession.startTime ? (
                    <div className="mt-0.5 text-sm hz-mono" style={{ color: "var(--hz-ink-2)" }}>
                      starts {nextSession.startTime}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Link>
        </section>
      ) : null}

      {/* Today's sessions */}
      {todaysSessions.length > 0 ? (
        <section className="space-y-2">
          <h2 className="section-title">Today</h2>
          {todaysSessions.map((s) => (
            <Link
              key={s.sessionId}
              href={`/teacher/sessions/${s.sessionId}`}
              className="hz-card overflow-hidden block glow-primary"
              style={{ borderColor: "var(--hz-primary)" }}
            >
              <div className="flex items-stretch">
                <div
                  className="flex flex-col items-center justify-center px-5"
                  style={{ background: "var(--hz-primary)", color: "#0B0E14", minWidth: 110 }}
                >
                  <span className="text-xs hz-mono uppercase tracking-[.16em] font-semibold">
                    Today
                  </span>
                  <span className="font-display text-3xl font-medium leading-none mt-1">
                    {format(today, "dd")}
                  </span>
                  <span className="text-xs hz-mono uppercase">
                    {format(today, "EEE")}
                  </span>
                </div>
                <div className="flex-1 p-4 flex items-center gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div
                      className="text-xs hz-mono uppercase tracking-[.16em]"
                      style={{ color: "var(--hz-primary)" }}
                    >
                      Batch {s.batchCode} · M{s.moduleNumber}
                    </div>
                    <div className="mt-1 font-display text-lg font-medium">{s.moduleName}</div>
                    <div className="mt-0.5 text-sm hz-mono" style={{ color: "var(--hz-ink-2)" }}>
                      <span className="text-base" style={{ color: "var(--hz-ink)" }}>
                        {s.startTime} – {s.endTime}
                      </span>
                      <span className="mx-1.5" style={{ color: "var(--hz-ink-3)" }}>·</span>
                      {s.enrolledCount} enrolled
                    </div>
                  </div>
                  <span className="btn-primary ml-auto shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    Mark attendance
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      {/* My batches */}
      <section className="space-y-2">
        <h2 className="section-title">My batches</h2>
        {batches.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-8 text-center hz-mono text-sm"
            style={{ color: "var(--hz-ink-3)", borderColor: "var(--hz-line)" }}
          >
            No batches assigned yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {batches.map((b) => {
              const firstClassroom = b.sessions[0]?.scheduledDate;
              const lastClassroom = b.sessions[b.sessions.length - 1]?.scheduledDate;
              const s = runtimeStatus(b);
              const tone = {
                ACTIVE: "var(--hz-success)",
                UPCOMING: "var(--hz-warning)",
                FINISHED: "var(--hz-ink-3)",
              }[s];
              const label =
                s === "ACTIVE" ? "Active" : s === "UPCOMING" ? "Upcoming" : "Finished";
              const startsRel = differenceInCalendarDays(b.startDate, today);
              const relText =
                startsRel === 0
                  ? "today"
                  : startsRel > 0
                    ? `starts in ${startsRel} days`
                    : `started ${Math.abs(startsRel)} days ago`;
              return (
                <Link
                  key={b.id}
                  href={`/teacher/batches/${b.id}`}
                  className="hz-card p-4 transition"
                  style={{ opacity: s === "FINISHED" ? 0.7 : 1 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="hz-mono text-lg font-semibold"
                          style={{ color: "var(--hz-primary)" }}
                        >
                          {b.code}
                        </span>
                        <span className="status-pill" style={{ color: tone }}>
                          <span className="dot" style={{ background: tone }} />
                          {label}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-medium">{b.course.name}</div>
                    </div>
                    <span className="hz-mono text-base font-semibold">
                      {b._count.enrollments}
                      <span className="text-xs" style={{ color: "var(--hz-ink-3)" }}>
                        {" "}
                        students
                      </span>
                    </span>
                  </div>
                  <div
                    className="mt-3 text-xs hz-mono"
                    style={{ color: "var(--hz-ink-3)" }}
                  >
                    {firstClassroom && lastClassroom
                      ? `${format(firstClassroom, "MMM dd")} – ${format(lastClassroom, "MMM dd yyyy")}`
                      : "Dates pending"}
                    <span className="mx-1.5">·</span>
                    {relText}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
