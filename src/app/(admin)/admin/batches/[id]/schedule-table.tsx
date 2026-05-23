import Link from "next/link";
import { format, isSameDay, isBefore, startOfToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { weekdayHolidaysBetween } from "@/lib/cronograma/holidays";

// Compact A4-portrait-friendly cronograma. Each module renders in ~3 lines so
// the full PLA layout fits a single printed page. Status-coloured day chips
// (held / today / upcoming) replace the previous month-of-the-batch palette —
// the month colour wasn't carrying useful information, and the legend at the
// bottom existed only to explain it.

type SessionStatus = "SCHEDULED" | "HELD" | "CANCELLED" | "RESCHEDULED";

type Session = {
  id: string;
  scheduledDate: Date;
  startTime: string | null;
  endTime: string | null;
  hours: number;
  kind: "CLASSROOM" | "AUTONOMOUS" | "EXAM";
  sequenceInModule: number;
  status: SessionStatus;
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

type DayState = "held" | "today" | "cancelled" | "upcoming";

function stateFor(session: Session, today: Date): DayState {
  if (session.status === "HELD") return "held";
  if (session.status === "CANCELLED") return "cancelled";
  if (isSameDay(session.scheduledDate, today)) return "today";
  return "upcoming";
}

export function ScheduleTable({
  batch,
  isPrint,
}: {
  batch: Batch;
  isPrint: boolean;
}) {
  const today = startOfToday();
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
  const heldCount = classroom.filter((s) => s.status === "HELD").length;

  // Assume a single time window for all classroom rows (PLA convention) so we
  // can show it once at the top instead of repeating it on every module row.
  const timeWindow =
    classroom[0]?.startTime && classroom[0]?.endTime
      ? `${classroom[0].startTime}–${classroom[0].endTime}`
      : "";

  return (
    <div className={isPrint ? "p-0" : "space-y-4"}>
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

      <article className="cronograma-sheet mx-auto">
        {/* Title */}
        <header className="text-center mb-3 print:mb-2">
          <div className="text-base font-semibold leading-tight">
            Cronograma — {batch.course.name}
          </div>
          <div className="mt-1 hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
            nível {batch.course.level} · Turma {batch.code} ·{" "}
            {format(batch.startDate, "dd MMM yyyy")}
            {endDate ? ` – ${format(endDate, "dd MMM yyyy")}` : ""} ·{" "}
            <span style={{ color: "var(--hz-ink)" }}>{totalHours} horas</span>
            {timeWindow ? (
              <>
                {" · "}
                <span style={{ color: "var(--hz-ink)" }}>{timeWindow}</span>
              </>
            ) : null}{" "}
            · Formador:{" "}
            <span style={{ color: "var(--hz-ink)" }}>
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
            const heldInModule = g.rows.filter((r) => r.status === "HELD").length;
            const pct = Math.round((heldInModule / g.rows.length) * 100);
            const moduleIsDone = heldInModule === g.rows.length;
            const moduleIsActive =
              !moduleIsDone &&
              (g.rows.some((r) => isSameDay(r.scheduledDate, today)) ||
                (isBefore(first, today) && !isBefore(last, today)));

            return (
              <section
                key={g.module.id}
                className="cron-module"
                data-state={
                  moduleIsDone ? "done" : moduleIsActive ? "active" : "upcoming"
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xs leading-tight">
                    <span className="cron-mlabel">M{g.module.number}</span>
                    <span className="font-semibold ml-1.5">{g.module.name}</span>
                  </div>
                  <div className="hz-mono text-xs whitespace-nowrap" style={{ color: "var(--hz-ink-3)" }}>
                    {format(first, "dd MMM")} – {format(last, "dd MMM yyyy")}
                  </div>
                </div>

                <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                  <div className="flex flex-wrap gap-1">
                    {g.rows.map((r) => {
                      const state = stateFor(r, today);
                      return (
                        <span
                          key={r.id}
                          className="cron-chip"
                          data-state={state}
                          title={`${format(r.scheduledDate, "EEEE dd MMM yyyy")} · ${r.status.toLowerCase()}`}
                        >
                          <span className="cron-chip-wd">
                            {format(r.scheduledDate, "EEE")}
                          </span>
                          <span className="cron-chip-day">
                            {format(r.scheduledDate, "dd/MM")}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                  {g.homeworkHours ? (
                    <span
                      className="hz-mono text-xs ml-auto whitespace-nowrap"
                      style={{ color: "var(--hz-ink-3)" }}
                    >
                      + {g.homeworkHours}h autónomo
                    </span>
                  ) : null}
                </div>

                {/* Per-module progress strip — quiet, only carries info */}
                <div className="cron-progress mt-1.5">
                  <span style={{ width: `${pct}%` }} />
                </div>

                {skipped.length > 0 ? (
                  <div className="cron-holiday mt-1.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>
                      Skipped holiday{skipped.length > 1 ? "s" : ""}:{" "}
                      {skipped
                        .map(
                          (h) =>
                            `${format(h.date, "EEE dd/MM")} — ${h.name}`,
                        )
                        .join(" · ")}
                    </span>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        {/* Status legend — replaces the old per-month colour key, which only
            documented an arbitrary palette choice. */}
        <div className="cron-legend mt-3 print:mt-2">
          <span className="cron-legend-label">Legend</span>
          <span className="cron-chip" data-state="held"><span className="cron-chip-day">Held</span></span>
          <span className="cron-chip" data-state="today"><span className="cron-chip-day">Today</span></span>
          <span className="cron-chip" data-state="upcoming"><span className="cron-chip-day">Upcoming</span></span>
          <span
            className="hz-mono text-[10px] ml-auto"
            style={{ color: "var(--hz-ink-3)" }}
          >
            {heldCount} / {classroom.length} sessões realizadas
          </span>
        </div>

        <footer className="cron-footer mt-3 print:mt-2">
          {batch.course.name} · Turma {batch.code} · gerado por Horizonte CRM
        </footer>
      </article>

      <style>{`
        .cronograma-sheet {
          max-width: 760px;
          color: var(--hz-ink);
        }

        .cron-module {
          border: 1px solid var(--hz-line);
          background: var(--hz-surface-2);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .cron-module[data-state="active"] {
          border-color: var(--hz-primary);
          box-shadow: 0 0 0 1px color-mix(in oklab, var(--hz-primary) 35%, transparent);
        }
        .cron-module[data-state="done"] { opacity: 0.85; }

        .cron-mlabel {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--hz-ink-3);
          font-weight: 600;
          background: color-mix(in oklab, var(--hz-surface) 50%, transparent);
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* Day chips — outline by default, tinted by status only. */
        .cron-chip {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 6px;
          font-family: var(--font-mono);
          font-size: 11px;
          line-height: 1.4;
          border: 1px solid var(--hz-line);
          background: transparent;
          color: var(--hz-ink-2);
          white-space: nowrap;
        }
        .cron-chip[data-state="upcoming"] {
          color: var(--hz-ink-2);
        }
        .cron-chip[data-state="held"] {
          background: color-mix(in oklab, var(--hz-success) 12%, transparent);
          border-color: color-mix(in oklab, var(--hz-success) 45%, var(--hz-line));
          color: var(--hz-success);
        }
        .cron-chip[data-state="today"] {
          background: color-mix(in oklab, var(--hz-primary) 18%, transparent);
          border-color: var(--hz-primary);
          color: var(--hz-ink);
          box-shadow: 0 0 8px color-mix(in oklab, var(--hz-primary) 50%, transparent);
          font-weight: 600;
        }
        .cron-chip[data-state="cancelled"] {
          color: var(--hz-ink-3);
          text-decoration: line-through;
          border-style: dashed;
        }
        .cron-chip-wd {
          font-size: 9px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.7;
        }
        .cron-chip-day {
          font-weight: 600;
        }

        /* Per-module progress — barely there until something's held. */
        .cron-progress {
          height: 2px;
          background: var(--hz-line);
          border-radius: 999px;
          overflow: hidden;
        }
        .cron-progress > span {
          display: block;
          height: 100%;
          background: var(--hz-success);
          transition: width 200ms ease;
        }
        .cron-module[data-state="active"] .cron-progress > span {
          background: var(--hz-primary);
        }

        /* Skipped-holiday note — informational, not an error. */
        .cron-holiday {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--hz-warning);
          background: color-mix(in oklab, var(--hz-warning) 10%, transparent);
          border: 1px solid color-mix(in oklab, var(--hz-warning) 35%, var(--hz-line));
          border-radius: 6px;
          padding: 4px 8px;
        }

        .cron-legend {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          padding: 8px 12px;
          border-top: 1px solid var(--hz-line);
        }
        .cron-legend-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--hz-ink-3);
        }

        .cron-footer {
          text-align: center;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--hz-ink-3);
        }

        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body { background: white !important; color: black !important; }
          .cronograma-sheet {
            max-width: none;
            color: black;
          }
          .cron-module {
            background: white;
            border-color: #d4d4d8;
            page-break-inside: avoid;
          }
          .cron-mlabel { color: #71717a; background: #f4f4f5; }
          .cron-chip { border-color: #d4d4d8; color: #3f3f46; }
          .cron-chip[data-state="held"] { background: #dcfce7; border-color: #86efac; color: #166534; }
          .cron-chip[data-state="today"] { background: #ecfccb; border-color: #65a30d; color: #365314; box-shadow: none; }
          .cron-chip-wd { color: #71717a; }
          .cron-progress { background: #e4e4e7; }
          .cron-holiday { color: #b45309; background: #fef3c7; border-color: #fcd34d; }
          .cron-legend { border-top-color: #d4d4d8; }
          .cron-legend-label, .cron-footer { color: #71717a; }
        }
      `}</style>
    </div>
  );
}
