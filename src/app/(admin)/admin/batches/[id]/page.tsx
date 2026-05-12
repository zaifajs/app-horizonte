import Link from "next/link";
import { notFound } from "next/navigation";
import { format, isSameDay, isBefore, isAfter, startOfToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/db";
import { ScheduleTable } from "./schedule-table";
import { ScheduleCalendar } from "./schedule-calendar";
import { SessionRow } from "./session-row";

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

  const batch = await prisma.batch.findUnique({
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
  });
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

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Batch {batch.code}
            </h1>
            <Badge variant="outline">{batch.status.toLowerCase()}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {batch.course.code} — {batch.course.name} · level {batch.course.level}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/admin/batches/${batch.id}?view=table`}>
            <Button variant="outline">Compact</Button>
          </Link>
          <Link href={`/admin/batches/${batch.id}?view=calendar`}>
            <Button variant="outline">Calendar</Button>
          </Link>
          <Link href="/admin/batches">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </header>

      {sessionToday ? <TodayCard session={sessionToday} batchCode={batch.code} /> : null}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Starts" value={format(batch.startDate, "dd MMM yyyy")} />
        <Stat
          label="Ends (est.)"
          value={lastClassroomDate ? format(lastClassroomDate, "dd MMM yyyy") : "—"}
        />
        <Stat
          label="Time"
          value={`${batch.startTime}–${addHours(batch.startTime, batch.durationHours)}`}
        />
        <Stat label="Trainer" value={batch.trainer?.name ?? "Unassigned"} />
        <Stat label="Capacity" value={String(batch.capacity)} />
        <Stat label="Enrolled" value={String(batch._count.enrollments)} />
        <Stat label="Classroom sessions" value={String(classroomSessions.length)} />
        <Stat label="Autonomous blocks" value={String(batch.sessions.length - classroomSessions.length)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {byModule.map((m) => (
            <a
              key={m.mod.id}
              href={`#module-${m.mod.number}`}
              className="group rounded-xl border bg-white p-4 transition hover:border-foreground/30 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  MODULE {m.mod.number}
                </span>
                <ModuleStatusBadge status={m.status} />
              </div>
              <div className="mt-2 text-sm font-medium leading-snug">
                {m.mod.name}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {m.first && m.last
                  ? `${format(m.first, "dd MMM")} – ${format(m.last, "dd MMM yyyy")}`
                  : "Dates pending"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {m.hoursLogged}/{m.hoursPlanned}h classroom · {m.autonomous[0]?.hours ?? 0}h autonomous
              </div>
            </a>
          ))}
        </div>
      </section>

      <Separator />

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function TodayCard({
  session,
  batchCode,
}: {
  session: {
    module: { number: number; name: string };
    startTime: string | null;
    endTime: string | null;
    sequenceInModule: number;
  };
  batchCode: string;
}) {
  return (
    <div className="rounded-xl border bg-zinc-900 text-zinc-50 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-300">
          Today · Batch {batchCode}
        </div>
        <Badge className="bg-zinc-700 text-zinc-50 hover:bg-zinc-700">
          Module {session.module.number} · Day {session.sequenceInModule}
        </Badge>
      </div>
      <div className="mt-2 text-lg font-semibold">{session.module.name}</div>
      <div className="mt-1 text-sm text-zinc-300">
        {session.startTime}–{session.endTime}
      </div>
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

function ModuleStatusBadge({ status }: { status: ModuleStatus }) {
  if (status === "DONE")
    return <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">Done</Badge>;
  if (status === "IN_PROGRESS")
    return <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">In progress</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Upcoming</Badge>;
}

function SessionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SCHEDULED: { label: "Scheduled", cls: "text-muted-foreground" },
    HELD: { label: "Held", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    CANCELLED: { label: "Cancelled", cls: "bg-red-50 border-red-200 text-red-700" },
    RESCHEDULED: { label: "Rescheduled", cls: "bg-blue-50 border-blue-200 text-blue-700" },
  };
  const m = map[status] ?? map.SCHEDULED;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h + hours).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
