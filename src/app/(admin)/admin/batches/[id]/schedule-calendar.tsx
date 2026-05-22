import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  format,
  isWeekend,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { holidayOn } from "@/lib/cronograma/holidays";

type Session = {
  id: string;
  scheduledDate: Date;
  startTime: string | null;
  endTime: string | null;
  hours: number;
  kind: "CLASSROOM" | "AUTONOMOUS";
  sequenceInModule: number;
  module: { id: string; number: number; name: string };
};

type Batch = {
  id: string;
  code: string;
  startDate: Date;
  durationHours: number;
  course: { name: string; level: string };
  trainer: { name: string } | null;
  sessions: Session[];
};

// Tailwind palette per module so cells are scannable. Cycles for >6 modules.
const MODULE_COLORS = [
  { bg: "bg-sky-100",    text: "text-sky-900",    ring: "ring-sky-300" },
  { bg: "bg-emerald-100", text: "text-emerald-900", ring: "ring-emerald-300" },
  { bg: "bg-amber-100",   text: "text-amber-900",   ring: "ring-amber-300" },
  { bg: "bg-violet-100",  text: "text-violet-900",  ring: "ring-violet-300" },
  { bg: "bg-rose-100",    text: "text-rose-900",    ring: "ring-rose-300" },
  { bg: "bg-cyan-100",    text: "text-cyan-900",    ring: "ring-cyan-300" },
];

function colorFor(moduleNumber: number) {
  return MODULE_COLORS[(moduleNumber - 1) % MODULE_COLORS.length];
}

export function ScheduleCalendar({
  batch,
  isPrint,
}: {
  batch: Batch;
  isPrint: boolean;
}) {
  const classroom = batch.sessions
    .filter((s) => s.kind === "CLASSROOM")
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

  if (classroom.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No classroom sessions to render yet.
      </div>
    );
  }

  // Map ISO date → session for fast lookup in the grid.
  const byIso = new Map<string, Session>();
  for (const s of classroom) {
    byIso.set(s.scheduledDate.toISOString().slice(0, 10), s);
  }

  // Months from first to last classroom day.
  const first = classroom[0].scheduledDate;
  const last = classroom[classroom.length - 1].scheduledDate;
  const months: Date[] = [];
  let cursor = startOfMonth(first);
  while (cursor <= startOfMonth(last)) {
    months.push(cursor);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  const usedModules = new Map<number, string>();
  for (const s of classroom) {
    if (!usedModules.has(s.module.number)) {
      usedModules.set(s.module.number, s.module.name);
    }
  }

  const totalHours = classroom.reduce((a, b) => a + b.hours, 0) +
    batch.sessions
      .filter((s) => s.kind === "AUTONOMOUS")
      .reduce((a, b) => a + b.hours, 0);
  const endDate = classroom[classroom.length - 1]?.scheduledDate;
  const timeWindow =
    classroom[0]?.startTime && classroom[0]?.endTime
      ? `${classroom[0].startTime}–${classroom[0].endTime}`
      : "";

  return (
    <div className={isPrint ? "p-0 bg-white text-zinc-900" : "space-y-4"}>
      {!isPrint ? (
        <div className="flex items-center justify-between print:hidden">
          <h1 className="text-lg font-semibold">Calendar — {batch.code}</h1>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/batches/${batch.id}?view=calendar&print=1`} target="_blank">
              <Button variant="outline">Print / PDF</Button>
            </Link>
            <Link href={`/admin/batches/${batch.id}?view=table`}>
              <Button variant="outline">Compact view</Button>
            </Link>
            <Link href={`/admin/batches/${batch.id}`}>
              <Button variant="outline">Journey view</Button>
            </Link>
          </div>
        </div>
      ) : null}

      <article className="cal-sheet mx-auto bg-white">
        <header className="text-center mb-3 print:mb-2">
          <div className="text-sm font-semibold leading-tight">
            Cronograma — {batch.course.name}
          </div>
          <div className="text-xs text-zinc-600">
            nível {batch.course.level} · Turma {batch.code} ·{" "}
            {format(batch.startDate, "dd MMM yyyy")}
            {endDate ? ` – ${format(endDate, "dd MMM yyyy")}` : ""} ·{" "}
            <span className="font-medium">{totalHours} horas</span> · Formador:{" "}
            <span className="font-medium">
              {batch.trainer?.name ?? "Unassigned"}
            </span>
            {timeWindow ? <> · {timeWindow}</> : null}
          </div>
        </header>

        {/* Module legend */}
        <div className="flex flex-wrap gap-2 justify-center mb-3 print:mb-2 text-xs">
          {Array.from(usedModules.entries())
            .sort(([a], [b]) => a - b)
            .map(([num, name]) => {
              const c = colorFor(num);
              return (
                <span
                  key={num}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${c.bg} ${c.text}`}
                >
                  <span className="font-semibold">M{num}</span>
                  <span className="truncate max-w-[20ch]">{name}</span>
                </span>
              );
            })}
        </div>

        {/* Month grids */}
        <div className="space-y-4 print:space-y-3">
          {months.map((month) => (
            <MonthGrid key={month.toISOString()} month={month} byIso={byIso} />
          ))}
        </div>

        <footer className="mt-3 text-center text-[9px] text-zinc-500 print:mt-2">
          Turma {batch.code} · gerado por Horizonte CRM
        </footer>
      </article>

      <style>{`
        .cal-sheet { max-width: 760px; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { background: white !important; }
          .cal-sheet { max-width: none; font-size: 10pt; }
        }
      `}</style>
    </div>
  );
}

function MonthGrid({
  month,
  byIso,
}: {
  month: Date;
  byIso: Map<string, Session>;
}) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  return (
    <section>
      <div className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-700 mb-1">
        {format(month, "MMMM yyyy")}
      </div>
      <div className="grid grid-cols-7 text-[9px] uppercase text-zinc-500 mb-0.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center py-0.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-zinc-200 border border-zinc-200 print:border-zinc-400">
        {days.map((d) => {
          const iso = d.toISOString().slice(0, 10);
          const session = byIso.get(iso);
          const inMonth = isSameMonth(d, month);
          const weekend = isWeekend(d);

          if (session) {
            const c = colorFor(session.module.number);
            return (
              <div
                key={iso}
                className={`min-h-[60px] p-1 ${c.bg} ${c.text} flex flex-col justify-between`}
              >
                <div className="flex items-baseline justify-between leading-none">
                  <span className="text-xs font-medium text-zinc-700">
                    {format(d, "d")}
                  </span>
                  <span className="text-[9px] font-semibold opacity-80">
                    M{session.module.number}
                  </span>
                </div>
                <div className="text-[9px] tabular-nums leading-tight opacity-90 mt-1">
                  {session.startTime}–{session.endTime}
                </div>
              </div>
            );
          }
          // Empty (non-class) day — flag weekday holidays.
          const hol = inMonth && !weekend ? holidayOn(d) : null;
          if (hol) {
            return (
              <div
                key={iso}
                className="min-h-[60px] p-1 bg-red-50 text-red-800 flex flex-col justify-between border border-red-200/60 print:border-red-300"
                title={hol.name}
              >
                <div className="flex items-baseline justify-between leading-none">
                  <span className="text-xs font-medium">{format(d, "d")}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide">
                    Holiday
                  </span>
                </div>
                <div className="text-[9px] leading-tight mt-1 line-clamp-2">
                  {hol.name}
                </div>
              </div>
            );
          }
          return (
            <div
              key={iso}
              className={`min-h-[60px] p-1 ${
                inMonth ? "bg-white" : "bg-zinc-50"
              } ${weekend && inMonth ? "bg-zinc-50/80" : ""}`}
            >
              <span
                className={`text-xs ${
                  inMonth ? "text-zinc-700" : "text-zinc-300"
                }`}
              >
                {format(d, "d")}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
