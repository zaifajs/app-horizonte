import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

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
          <div className="text-[15px] font-semibold leading-tight">
            Cronograma — {batch.course.name}
          </div>
          <div className="text-[10px] text-zinc-600">
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
            return (
              <section
                key={g.module.id}
                className="rounded-md border border-zinc-300 px-3 py-1.5 print:rounded-none print:border-zinc-400"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[12px] leading-tight">
                    <span className="text-zinc-500 font-semibold mr-1">
                      M{g.module.number}
                    </span>
                    <span className="font-semibold">{g.module.name}</span>
                  </div>
                  <div className="text-[10px] text-zinc-600 whitespace-nowrap">
                    {format(first, "dd MMM")} – {format(last, "dd MMM yyyy")}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-[11px] tabular-nums">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {g.rows.map((r) => (
                      <span key={r.id} className="text-zinc-700">
                        <span className="text-[9px] uppercase text-zinc-500 mr-0.5">
                          {format(r.scheduledDate, "EEE")}
                        </span>
                        <span className="font-medium">
                          {format(r.scheduledDate, "dd/MM")}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-zinc-600 whitespace-nowrap">
                    {timeWindow}
                    {g.homeworkHours
                      ? ` · +${g.homeworkHours}h trabalho autónomo`
                      : ""}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

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
