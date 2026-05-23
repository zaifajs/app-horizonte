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
import { TrainerAssign } from "./trainer-assign";
import { ModuleSection } from "./module-section";
import { EditBatchTrigger } from "./edit-batch-trigger";
import { ExamSchedule, type ExamScheduleRow } from "./exam-schedule";

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
        course: {
          include: {
            modules: {
              orderBy: { number: "asc" },
              include: {
                exams: {
                  select: {
                    id: true,
                    title: true,
                    durationMinutes: true,
                    _count: { select: { questions: true } },
                  },
                },
              },
            },
          },
        },
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
  const enrolledPct = Math.min(
    100,
    Math.round((batch._count.enrollments / Math.max(1, batch.capacity)) * 100),
  );
  const sessionsPct = Math.min(
    100,
    Math.round((heldClassroom / Math.max(1, classroomSessions.length)) * 100),
  );
  const startedDays = differenceInCalendarDays(today, batch.startDate);
  const startsSubtitle =
    startedDays === 0
      ? "starts today"
      : startedDays > 0
        ? `started ${startedDays} ${startedDays === 1 ? "day" : "days"} ago`
        : `starts in ${Math.abs(startedDays)} days`;
  const endsSubtitle = lastClassroomDate
    ? (() => {
        const d = differenceInCalendarDays(lastClassroomDate, today);
        return d === 0 ? "ends today" : d > 0 ? `ends in ${d} days` : `ended ${Math.abs(d)} days ago`;
      })()
    : "no end date yet";

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

  const editInitial = {
    id: batch.id,
    code: batch.code,
    startDate: batch.startDate.toISOString().slice(0, 10),
    startTime: batch.startTime,
    durationHours: batch.durationHours,
    capacity: batch.capacity,
    status: batch.status,
  };

  // Auto-expand the in-progress module + today's module (if different) so the
  // common case is no clicks. Anything else stays collapsed.
  const todaysModuleNumber = sessionToday?.module.number ?? null;
  const inProgressModuleNumber =
    byModule.find((m) => m.status === "IN_PROGRESS")?.mod.number ?? null;

  // Per-module exam scheduling rows for the ExamSchedule section. Pairs each
  // course module with its Exam definition (if authored) and any scheduled
  // EXAM-kind session on this batch.
  const examRows: ExamScheduleRow[] = batch.course.modules.map((mod) => {
    const exam = mod.exams[0] ?? null;
    const examSession = batch.sessions.find(
      (s) => s.kind === "EXAM" && s.moduleId === mod.id,
    );
    return {
      moduleId: mod.id,
      moduleNumber: mod.number,
      moduleName: mod.name,
      exam: exam
        ? {
            id: exam.id,
            title: exam.title,
            questionCount: exam._count.questions,
            durationMinutes: exam.durationMinutes,
          }
        : null,
      scheduled: examSession
        ? {
            sessionId: examSession.id,
            scheduledDate: examSession.scheduledDate.toISOString().slice(0, 10),
            startTime: examSession.startTime,
          }
        : null,
    };
  });

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
          <EditBatchTrigger initial={editInitial} />
          <Link
            href={`/admin/students?batch=${encodeURIComponent(batch.code)}`}
            className="btn-ghost"
            title="Open the roster filtered to this batch"
          >
            Roster
          </Link>
          <Link href={`/admin/batches/${batch.id}/attendance`} className="btn-ghost">
            Attendance
          </Link>
          <Link
            href={`/api/students/export?batch=${encodeURIComponent(batch.code)}&status=ACTIVE&sort=name&dir=asc`}
            className="btn-ghost"
            title="Export the active roster as CSV"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
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

      {/* Stats grid — trimmed to 4 tiles. Trainer pulled out into its own
          row below so the grid is purely informational. */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Schedule"
          value={`${format(batch.startDate, "MMM dd")}${lastClassroomDate ? ` – ${format(lastClassroomDate, "MMM dd")}` : ""}`}
          sub={`${startsSubtitle} · ${endsSubtitle}`}
        />
        <StatTile
          label="Time"
          value={`${batch.startTime} – ${addHours(batch.startTime, batch.durationHours)}`}
          sub={`${batch.durationHours}h / day`}
        />
        <StatTile
          label="Enrolment"
          value={`${batch._count.enrollments} / ${batch.capacity}`}
          sub={`${enrolledPct}% full`}
          progress={{ pct: enrolledPct, color: "var(--hz-primary)" }}
        />
        <StatTile
          label="Progress"
          value={`${heldClassroom} / ${classroomSessions.length}`}
          sub={`${totalHoursLogged} / ${totalHoursPlanned}h held`}
          progress={{ pct: sessionsPct, color: "var(--hz-success)" }}
        />
      </section>

      {/* Trainer — pulled out of the stats grid so the dropdown sits on
          its own row instead of breaking the "tile = facts" pattern. */}
      <section className="hz-card p-3 flex items-center gap-3 flex-wrap">
        <span
          className="text-xs hz-mono uppercase tracking-[.16em]"
          style={{ color: "var(--hz-ink-3)" }}
        >
          Trainer
        </span>
        <TrainerAssign
          batchId={batch.id}
          currentTrainerId={batch.trainer?.id ?? null}
          trainers={
            batch.trainer && !trainers.some((t) => t.id === batch.trainer!.id)
              ? [{ id: batch.trainer.id, name: `${batch.trainer.name} (inactive)` }, ...trainers]
              : trainers
          }
        />
      </section>

      {/* Cronograma — view switcher + collapsible modules */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="section-title">Cronograma · {batch.course.modules.length} modules</h2>
          <div className="seg">
            <ViewLink batchId={batch.id} view="journey" active>Journey</ViewLink>
            <ViewLink batchId={batch.id} view="calendar">Calendar</ViewLink>
            <ViewLink batchId={batch.id} view="table">Compact</ViewLink>
          </div>
        </div>

        <div className="space-y-3">
          {byModule.map((m) => (
            <ModuleSection
              key={m.mod.id}
              number={m.mod.number}
              name={m.mod.name}
              status={m.status}
              first={m.first}
              last={m.last}
              hoursLogged={m.hoursLogged}
              hoursPlanned={m.hoursPlanned}
              classroom={m.classroom}
              autonomous={m.autonomous[0] ?? null}
              today={today}
              defaultOpen={
                m.mod.number === inProgressModuleNumber ||
                m.mod.number === todaysModuleNumber
              }
            />
          ))}
        </div>
      </section>

      <ExamSchedule batchId={batch.id} rows={examRows} canSchedule />
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
          // Long string values (date ranges, time spans) get a smaller mono
          // font so they fit; short labels stay big-display.
          fontSize: value.length > 12 ? "0.95rem" : "1.5rem",
          fontFamily:
            value.length > 12 ? "var(--font-mono)" : "var(--font-display)",
          lineHeight: 1.15,
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

function ViewLink({
  batchId,
  view,
  active,
  children,
}: {
  batchId: string;
  view: "journey" | "calendar" | "table";
  active?: boolean;
  children: React.ReactNode;
}) {
  const href =
    view === "journey"
      ? `/admin/batches/${batchId}`
      : `/admin/batches/${batchId}?view=${view}`;
  return (
    <Link href={href} className={active ? "on" : ""}>
      {children}
    </Link>
  );
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h + hours).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
