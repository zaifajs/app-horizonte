import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { weekdayHolidaysBetween } from "@/lib/cronograma/holidays";

// Tailwind palette cycled per month-of-batch (first month → palette[0], etc.).
const MONTH_PALETTE = [
  { bg: "bg-sky-100",     text: "text-sky-900" },
  { bg: "bg-emerald-100", text: "text-emerald-900" },
  { bg: "bg-amber-100",   text: "text-amber-900" },
  { bg: "bg-violet-100",  text: "text-violet-900" },
  { bg: "bg-rose-100",    text: "text-rose-900" },
  { bg: "bg-cyan-100",    text: "text-cyan-900" },
];

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Compact A4-portrait-friendly cronograma. Each module renders in ~3 lines so
// the full PLA layout fits a single printed page.

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

export function ScheduleTable({
  batch,
  isPrint,
}: {
  batch: Batch;
  isPrint: boolean;
}) {
  const classroom = batch.sessions
    .filter((s) => s.kind === "CLASSROOM")
    .sort(
      (a, b) =>
        a.scheduledDate.getTime() - b.scheduledDate.getTime() ||
        a.sequenceInModule - b.sequenceInModule,
    );

  const autonomousByModule = new Map(
    batch.sessions
      .filter((s) => s.kind === "AUTONOMOUS")
      .map((s) => [s.module.id, s.hours]),
  );

  // Group classroom rows by module.
  const modules: Array<{
    module: Session["module"];
    rows: Session[];
    homeworkHours: number | null;
  }> = [];
  for (const s of classroom) {
    let g = modules[modules.length - 1];
    if (!g || g.module.id !== s.module.id) {
      g = {
        module: s.module,
        rows: [],
        homeworkHours: autonomousByModule.get(s.module.id) ?? null,
      };
      modules.push(g);
    }
    g.rows.push(s);
  }

  const totalHours =
    classroom.reduce((a, b) => a + b.hours, 0) +
    Array.from(autonomousByModule.values()).reduce((a, b) => a + b, 0);
  const endDate = classroom[classroom.length - 1]?.scheduledDate;

  // Build month → palette mapping in order of first appearance.
  const monthOrder: string[] = [];
  for (const s of classroom) {
    const k = monthKey(s.scheduledDate);
    if (!monthOrder.includes(k)) monthOrder.push(k);
  }
  const monthColor = new Map<string, (typeof MONTH_PALETTE)[number]>();
  monthOrder.forEach((k, i) =>
    monthColor.set(k, MONTH_PALETTE[i % MONTH_PALETTE.length]),
  );
  const monthLabel = new Map<string, string>();
  for (const s of classroom) {
    const k = monthKey(s.scheduledDate);
    if (!monthLabel.has(k)) {
      monthLabel.set(k, format(s.scheduledDate, "MMMM yyyy"));
    }
  }

  // Assume a single time window for all classroom rows (PLA convention).
  const timeWindow =
    classroom[0]?.startTime && classroom[0]?.endTime
      ? `${classroom[0].startTime}–${classroom[0].endTime}`
      : "";

  return (
    <div className={isPrint ? "p-0 bg-white text-zinc-900" : "space-y-4"}>
      {!isPrint ? (
        <div className="flex items-center justify-between print:hidden">
          <h1 className="text-lg font-semibold">Schedule — {batch.code}</h1>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/batches/${batch.id}?view=table&print=1`} target="_blank">
              <Button variant="outline">Print / PDF</Button>
            </Link>
            <Link href={`/admin/batches/${batch.id}?view=calendar`}>
              <Button variant="outline">Calendar</Button>
            </Link>
            <Link href={`/admin/batches/${batch.id}`}>
              <Button variant="outline">Journey view</Button>
            </Link>
          </div>
        </div>
      ) : null}

      <article className="cronograma-sheet mx-auto bg-white">
        {/* Title */}
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
          </div>
        </header>

        {/* Module rows */}
        <div className="space-y-2 print:space-y-1.5">
          {modules.map((g) => {
            const first = g.rows[0].scheduledDate;
            const last = g.rows[g.rows.length - 1].scheduledDate;
            const skipped = weekdayHolidaysBetween(first, last);
            return (
              <section
                key={g.module.id}
                className="rounded-md border border-zinc-300 px-3 py-1.5 print:rounded-none print:border-zinc-400"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xs leading-tight">
                    <span className="text-zinc-500 font-semibold mr-1">
                      M{g.module.number}
                    </span>
                    <span className="font-semibold">{g.module.name}</span>
                  </div>
                  <div className="text-xs text-zinc-600 whitespace-nowrap">
                    {format(first, "dd MMM")} – {format(last, "dd MMM yyyy")}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs tabular-nums">
                  <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                    {g.rows.map((r) => {
                      const c = monthColor.get(monthKey(r.scheduledDate)) ?? MONTH_PALETTE[0];
                      return (
                        <span
                          key={r.id}
                          className={`inline-flex items-baseline gap-1 rounded-md px-1.5 py-0.5 ${c.bg} ${c.text}`}
                        >
                          <span className="text-[9px] uppercase opacity-70">
                            {format(r.scheduledDate, "EEE")}
                          </span>
                          <span className="font-medium">
                            {format(r.scheduledDate, "dd/MM")}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                  <div className="text-xs text-zinc-600 whitespace-nowrap">
                    {timeWindow}
                    {g.homeworkHours
                      ? ` · +${g.homeworkHours}h trabalho autónomo`
                      : ""}
                  </div>
                </div>
                {skipped.length > 0 ? (
                  <div className="mt-1 text-xs text-red-700">
                    <span className="font-semibold mr-1">
                      Skipped holiday{skipped.length > 1 ? "s" : ""}:
                    </span>
                    {skipped
                      .map((h) => `${format(h.date, "EEE")} ${format(h.date, "dd/MM")} — ${h.name}`)
                      .join(" · ")}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        {monthOrder.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs print:mt-2">
            <span className="text-zinc-500 uppercase tracking-wide font-semibold">
              Months
            </span>
            {monthOrder.map((k) => {
              const c = monthColor.get(k)!;
              return (
                <span
                  key={k}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${c.bg} ${c.text}`}
                >
                  <span className="font-medium">{monthLabel.get(k)}</span>
                </span>
              );
            })}
          </div>
        ) : null}

        <footer className="mt-3 text-center text-[9px] text-zinc-500 print:mt-2">
          {batch.course.name} · Turma {batch.code} · gerado por Horizonte CRM
        </footer>
      </article>

      <style>{`
        .cronograma-sheet {
          max-width: 720px;
        }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body { background: white !important; }
          .cronograma-sheet {
            max-width: none;
            font-size: 10pt;
          }
        }
      `}</style>
    </div>
  );
}
