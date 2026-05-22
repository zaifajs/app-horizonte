import Link from "next/link";
import { notFound } from "next/navigation";
import {
  format,
  isSameDay,
  isBefore,
  isAfter,
  startOfToday,
  differenceInCalendarDays,
} from "date-fns";
import { prisma } from "@/lib/db";
import { ScheduleTable } from "./schedule-table";
import { ScheduleCalendar } from "./schedule-calendar";
import { SessionRow } from "./session-row";
import { TrainerAssign } from "./trainer-assign";

export const dynamic = "force-dynamic";

type ModuleStatus = "UPCOMING" | "IN_PROGRESS" | "DONE";

export default async function BatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; print?: string }>;
}) {
  const { id } = await params;
  const { view, print } = await searchParams;

  const [batch, trainers] = await Promise.all([
    prisma.batch.findUnique({
      where: { id },
      include: {
        course: { include: { modules: { orderBy: { number: "asc" } } } },
        trainer: { select: { id: true, name: true } },
        sessions: {
          orderBy: [{ scheduledDate: "asc" }, { kind: "asc" }],
          include: { module: { select: { id: true, number: true, name: true } } },
        },
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "TEACHER", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!batch) notFound();

  const today = startOfToday();
  const classroomSessions = batch.sessions.filter((s) => s.kind === "CLASSROOM");
  const lastClassroomDate = classroomSessions[classroomSessions.length - 1]?.scheduledDate;
  const sessionToday = batch.sessions.find(
    (s) => s.kind === "CLASSROOM" && isSameDay(s.scheduledDate, today),
  );

  const isPrint = print === "1";
  if (view === "calendar") {
    return <ScheduleCalendar batch={batch} isPrint={isPrint} />;
  }
  if (view === "table") {
    return <ScheduleTable batch={batch} isPrint={isPrint} />;
  }

  // Default: journey view
  const byModule = batch.course.modules.map((mod) => {
    const classroom = classroomSessions.filter((s) => s.moduleId === mod.id);
    const autonomous = batch.sessions.filter(
      (s) => s.kind === "AUTONOMOUS" && s.moduleId === mod.id,
    );
    const first = classroom[0]?.scheduledDate ?? null;
    const last = classroom[classroom.length - 1]?.scheduledDate ?? null;
    const held = classroom.filter((s) => s.status === "HELD").length;
    let status: ModuleStatus = "UPCOMING";
    if (first && last) {
      if (held === classroom.length) {
        status = "DONE";
      } else if (!isAfter(first, today) && !isBefore(last, today)) {
        status = "IN_PROGRESS";
      } else if (isBefore(last, today)) {
        status = "IN_PROGRESS";
      }
    }
    const hoursLogged = classroom
      .filter((s) => s.status === "HELD")
      .reduce((a, b) => a + b.hours, 0);
    const hoursPlanned = classroom.reduce((a, b) => a + b.hours, 0);
    return { mod, classroom, autonomous, first, last, status, hoursLogged, hoursPlanned };
  });

  const heldClassroom = classroomSessions.filter((s) => s.status === "HELD").length;
  const totalHoursPlanned = classroomSessions.reduce((a, s) => a + s.hours, 0);
  const totalHoursLogged = classroomSessions
    .filter((s) => s.status === "HELD")
    .reduce((a, s) => a + s.hours, 0);
  const autonomousBlocks = batch.sessions.filter((s) => s.kind === "AUTONOMOUS");
  const autonomousDone = autonomousBlocks.filter((s) => s.status === "HELD").length;
  const enrolledPct = Math.min(
    100,
    Math.round((batch._count.enrollments / Math.max(1, batch.capacity)) * 100),
  );
  const heldPct = Math.min(
    100,
    Math.round((heldClassroom / Math.max(1, classroomSessions.length)) * 100),
  );
  const autoPct = Math.min(
    100,
    Math.round((autonomousDone / Math.max(1, autonomousBlocks.length)) * 100),
  );
  const startedDays = differenceInCalendarDays(today, batch.startDate);
  const startsSubtitle =
    startedDays === 0
      ? "today"
      : startedDays > 0
        ? `${startedDays} ${startedDays === 1 ? "day" : "days"} ago`
        : `in ${Math.abs(startedDays)} days`;
  const endsSubtitle = lastClassroomDate
    ? (() => {
        const d = differenceInCalendarDays(lastClassroomDate, today);
        return d === 0 ? "today" : d > 0 ? `in ${d} days` : `${Math.abs(d)} days ago`;
      })()
    : "—";

  const runtimeStatus: "ACTIVE" | "UPCOMING" | "FINISHED" =
    batch.status === "FINISHED" || batch.status === "CANCELLED"
      ? "FINISHED"
      : batch.startDate <= today
        ? "ACTIVE"
        : "UPCOMING";
  const statusMeta = {
    ACTIVE: { color: "var(--hz-success)", label: "Active" },
    UPCOMING: { color: "var(--hz-warning)", label: "Upcoming" },
    FINISHED: { color: "var(--hz-ink-3)", label: "Finished" },
  }[runtimeStatus];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div
            className="text-sm hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Batch detail
          </div>
          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            <h1 className="font-display text-4xl font-medium">
              Batch <span style={{ color: "var(--hz-primary)" }}>{batch.code}</span>
            </h1>
            <span className="chip chip-outline">
              {batch.course.code} · {batch.course.level}
            </span>
            <span className="status-pill" style={{ color: statusMeta.color }}>
              <span className="dot" style={{ background: statusMeta.color, boxShadow: `0 0 6px ${statusMeta.color}` }} />
              {statusMeta.label}
            </span>
          </div>
          <div className="mt-1.5 text-sm hz-mono" style={{ color: "var(--hz-ink-2)" }}>
            {batch.course.name}
            <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>·</span>
            {batch._count.enrollments} / {batch.capacity} students
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Link
            href={`/api/students/export?batch=${encodeURIComponent(batch.code)}&status=ACTIVE&sort=name&dir=asc`}
            className="btn-ghost"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export roster
          </Link>
          <Link
            href={`/admin/students?batch=${encodeURIComponent(batch.code)}`}
            className="btn-ghost"
          >
            Roster
          </Link>
          <Link href={`/admin/batches/${batch.id}/attendance`} className="btn-ghost">
            Attendance
          </Link>
          <Link href={`/admin/batches/${batch.id}?view=calendar`} className="btn-ghost">
            Calendar
          </Link>
          <Link href={`/admin/batches/${batch.id}?view=table`} className="btn-ghost">
            Compact
          </Link>
        </div>
      </section>

      {/* Today card */}
      {sessionToday ? (
        <section
          className="hz-card overflow-hidden glow-primary"
          style={{ borderColor: "var(--hz-primary)" }}
        >
          <div className="flex items-stretch">
            <div
              className="flex flex-col items-center justify-center px-6"
              style={{ background: "var(--hz-primary)", color: "#0B0E14", minWidth: 130 }}
            >
              <span className="text-xs hz-mono uppercase tracking-[.16em] font-semibold">
                Today
              </span>
              <span className="font-display text-4xl font-medium leading-none mt-1">
                {format(today, "dd")}
              </span>
              <span className="text-xs hz-mono uppercase">{format(today, "EEE · MMM")}</span>
            </div>
            <div className="flex-1 p-5 flex items-center gap-6 flex-wrap">
              <div className="min-w-0">
                <div
                  className="flex items-center gap-2 text-xs hz-mono uppercase tracking-[.16em]"
                  style={{ color: "var(--hz-primary)" }}
                >
                  <span
                    className="dot"
                    style={{ background: "var(--hz-primary)", boxShadow: "0 0 6px var(--hz-primary)" }}
                  />
                  Module {sessionToday.module.number} · Day {sessionToday.sequenceInModule}
                </div>
                <div className="mt-1.5 font-display text-xl font-medium">
                  {sessionToday.module.name}
                </div>
                <div className="mt-1 text-sm hz-mono" style={{ color: "var(--hz-ink-2)" }}>
                  <span className="text-base" style={{ color: "var(--hz-ink)" }}>
                    {sessionToday.startTime} – {sessionToday.endTime}
                  </span>
                  <span className="mx-1.5" style={{ color: "var(--hz-ink-3)" }}>·</span>
                  {sessionToday.hours}h · Classroom
                  {batch.trainer ? (
                    <>
                      <span className="mx-1.5" style={{ color: "var(--hz-ink-3)" }}>·</span>
                      {batch.trainer.name}
                    </>
                  ) : null}
                </div>
              </div>
              <Link
                href={`/teacher/sessions/${sessionToday.id}`}
                className="btn-primary ml-auto shrink-0"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                Mark attendance
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* Stats grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Starts" value={format(batch.startDate, "yyyy-MM-dd")} sub={startsSubtitle} />
        <StatTile
          label="Ends (est.)"
          value={lastClassroomDate ? format(lastClassroomDate, "yyyy-MM-dd") : "—"}
          sub={endsSubtitle}
        />
        <StatTile
          label="Time"
          value={`${batch.startTime} – ${addHours(batch.startTime, batch.durationHours)}`}
          sub={`${batch.durationHours}h / day`}
        />
        <div className="hz-card p-3">
          <div
            className="text-xs hz-mono uppercase tracking-[.16em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Trainer
          </div>
          <div className="mt-2">
            <TrainerAssign
              batchId={batch.id}
              currentTrainerId={batch.trainer?.id ?? null}
              trainers={
                batch.trainer && !trainers.some((t) => t.id === batch.trainer!.id)
                  ? [{ id: batch.trainer.id, name: `${batch.trainer.name} (inactive)` }, ...trainers]
                  : trainers
              }
            />
          </div>
        </div>

        <StatTile label="Capacity" value={String(batch.capacity)} sub="seats configured" />
        <div
          className="hz-card p-3"
          style={{
            borderColor: "rgba(182,255,60,0.25)",
            background: "var(--hz-primary-50)",
          }}
        >
          <div
            className="text-xs hz-mono uppercase tracking-[.16em]"
            style={{ color: "var(--hz-primary)" }}
          >
            Enrolled
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="stat-num text-3xl" style={{ color: "var(--hz-ink)" }}>
              {batch._count.enrollments}
            </span>
            <span className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
              / {batch.capacity}
            </span>
          </div>
          <div className="pbar mt-2">
            <span style={{ width: `${enrolledPct}%`, background: "var(--hz-primary)" }} />
          </div>
        </div>
        <StatTile
          label="Classroom sessions"
          value={String(heldClassroom)}
          sub={`/ ${classroomSessions.length} held · ${totalHoursLogged}/${totalHoursPlanned}h`}
          progress={{ pct: heldPct, color: "var(--hz-success)" }}
        />
        <StatTile
          label="Autonomous blocks"
          value={String(autonomousDone)}
          sub={`/ ${autonomousBlocks.length} done`}
          progress={{ pct: autoPct, color: "var(--hz-info)" }}
        />
      </section>

      {/* Modules timeline */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-3">
          <h2 className="section-title">Cronograma · {batch.course.modules.length} modules</h2>
          <div style={{ flex: 1, height: 1, background: "var(--hz-line)" }} />
          <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
            {totalHoursLogged} / {totalHoursPlanned} hours logged
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {byModule.map((m) => {
            const tone =
              m.status === "DONE"
                ? "var(--hz-success)"
                : m.status === "IN_PROGRESS"
                  ? "var(--hz-primary)"
                  : "var(--hz-ink-3)";
            const pct =
              m.hoursPlanned > 0
                ? Math.round((m.hoursLogged / m.hoursPlanned) * 100)
                : 0;
            return (
              <a
                key={m.mod.id}
                href={`#module-${m.mod.number}`}
                className="hz-card p-3 flex flex-col gap-2 transition"
                style={{
                  borderColor:
                    m.status === "IN_PROGRESS" ? "var(--hz-primary)" : "var(--hz-line)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="hz-mono text-xs font-semibold"
                    style={{ color: tone, letterSpacing: "0.16em" }}
                  >
                    MODULE {m.mod.number}
                  </span>
                  <span className="status-pill" style={{ color: tone, fontSize: "0.6875rem" }}>
                    {m.status === "DONE"
                      ? "Done"
                      : m.status === "IN_PROGRESS"
                        ? "Active"
                        : "Upcoming"}
                  </span>
                </div>
                <div
                  className="font-medium text-sm leading-snug"
                  style={{
                    color: m.status === "UPCOMING" ? "var(--hz-ink-2)" : "var(--hz-ink)",
                  }}
                >
                  {m.mod.name}
                </div>
                <div className="text-xs hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                  {m.first && m.last
                    ? `${format(m.first, "MMM dd")} – ${format(m.last, "MMM dd")}`
                    : "Dates pending"}
                </div>
                <div className="pbar mt-auto">
                  <span style={{ width: `${pct}%`, background: tone }} />
                </div>
                <div
                  className="flex items-center justify-between text-xs hz-mono"
                  style={{ color: "var(--hz-ink-3)" }}
                >
                  <span>
                    {m.hoursLogged} / {m.hoursPlanned} h
                  </span>
                  <span style={{ color: tone }}>{pct > 0 ? `${pct}%` : "—"}</span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <div style={{ height: 1, background: "var(--hz-line)" }} />

      <section className="space-y-8">
        {byModule.map((m) => (
          <ModuleDetail
            key={m.mod.id}
            number={m.mod.number}
            name={m.mod.name}
            classroom={m.classroom}
            autonomous={m.autonomous[0] ?? null}
            today={today}
          />
        ))}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  progress,
}: {
  label: string;
  value: string;
  sub?: string;
  progress?: { pct: number; color: string };
}) {
  return (
    <div className="hz-card p-3">
      <div
        className="text-xs hz-mono uppercase tracking-[.16em]"
        style={{ color: "var(--hz-ink-3)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 stat-num"
        style={{
          color: "var(--hz-ink)",
          fontSize: value.length > 10 ? "1.125rem" : "1.875rem",
          fontFamily:
            value.length > 10 ? "var(--font-mono)" : "var(--font-display)",
        }}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-xs hz-mono" style={{ color: "var(--hz-ink-3)" }}>
          {sub}
        </div>
      ) : null}
      {progress ? (
        <div className="pbar mt-2">
          <span style={{ width: `${progress.pct}%`, background: progress.color }} />
        </div>
      ) : null}
    </div>
  );
}

type SessionForRow = {
  id: string;
  scheduledDate: Date;
  startTime: string | null;
  endTime: string | null;
  sequenceInModule: number;
  status: "SCHEDULED" | "HELD" | "CANCELLED" | "RESCHEDULED";
  hours: number;
  notes: string | null;
};

function ModuleDetail({
  number,
  name,
  classroom,
  autonomous,
  today,
}: {
  number: number;
  name: string;
  classroom: SessionForRow[];
  autonomous: SessionForRow | null;
  today: Date;
}) {
  return (
    <div id={`module-${number}`} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-muted-foreground">
          MODULE {number}
        </span>
        <h3 className="text-base font-semibold tracking-tight">{name}</h3>
      </div>
      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 w-12">#</th>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">Hours</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {classroom.map((s) => (
              <SessionRow
                key={s.id}
                session={{ ...s, kind: "CLASSROOM" }}
                isToday={isSameDay(s.scheduledDate, today)}
              />
            ))}
            {autonomous ? (
              <SessionRow
                session={{ ...autonomous, kind: "AUTONOMOUS" }}
                isToday={isSameDay(autonomous.scheduledDate, today)}
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h + hours).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
