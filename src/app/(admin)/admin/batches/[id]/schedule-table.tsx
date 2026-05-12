import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

// Compact month-grouped cronograma. Used as a secondary view from
// /admin/batches/[id]?view=table (or ?print=1 for browser print).

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

type MonthGroup = {
  key: string; // "2026-04"
  label: string; // "April 2026"
  rows: Array<Session & { showModule: boolean; isLastInModule: boolean; autonomousHours: number | null }>;
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

  // Map moduleId → autonomous-hours so we can attach it to the last classroom day.
  const autonomousByModule = new Map(
    batch.sessions
      .filter((s) => s.kind === "AUTONOMOUS")
      .map((s) => [s.module.id, s.hours]),
  );

  // Annotate each classroom row.
  const annotated = classroom.map((s, i) => {
    const prev = i > 0 ? classroom[i - 1] : null;
    const next = i < classroom.length - 1 ? classroom[i + 1] : null;
    const showModule = !prev || prev.module.id !== s.module.id;
    const isLastInModule = !next || next.module.id !== s.module.id;
    return {
      ...s,
      showModule,
      isLastInModule,
      autonomousHours: isLastInModule
        ? autonomousByModule.get(s.module.id) ?? null
        : null,
    };
  });

  // Group by month.
  const groups: MonthGroup[] = [];
  for (const row of annotated) {
    const d = row.scheduledDate;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = format(d, "MMMM yyyy");
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label, rows: [] };
      groups.push(g);
    }
    g.rows.push(row);
  }

  const totalHours =
    classroom.reduce((a, b) => a + b.hours, 0) +
    Array.from(autonomousByModule.values()).reduce((a, b) => a + b, 0);
  const endDate = classroom[classroom.length - 1]?.scheduledDate;

  return (
    <div className={isPrint ? "p-6 bg-white text-zinc-900" : "space-y-4"}>
      {!isPrint ? (
        <div className="flex items-center justify-between print:hidden">
          <h1 className="text-lg font-semibold">
            Schedule — {batch.code}
          </h1>
          <div className="flex gap-2">
            <Link href={`/admin/batches/${batch.id}?print=1`} target="_blank">
              <Button variant="outline">Print / PDF</Button>
            </Link>
            <Link href={`/admin/batches/${batch.id}`}>
              <Button variant="outline">Journey view</Button>
            </Link>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white overflow-hidden print:border-0 print:rounded-none">
        {/* Header card */}
        <div className="border-b px-4 py-3 print:py-2 text-center">
          <div className="text-sm font-semibold text-blue-700 print:text-black">
            {batch.course.name}{" "}
            <span className="font-normal">· nível {batch.course.level}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Turma <span className="font-medium text-foreground">{batch.code}</span>
            {" "}· {format(batch.startDate, "dd MMM yyyy")}
            {endDate ? ` – ${format(endDate, "dd MMM yyyy")}` : ""}
            {" "}· {totalHours}h · Formador:{" "}
            <span className="font-medium text-foreground">
              {batch.trainer?.name ?? "Unassigned"}
            </span>
          </div>
        </div>

        {/* Month sections */}
        {groups.map((g) => (
          <div key={g.key} className="border-b last:border-b-0">
            <div className="bg-zinc-50 px-4 py-1.5 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              {g.label}
            </div>
            <table className="w-full text-[13px]">
              <tbody>
                {g.rows.map((row) => {
                  const date = row.scheduledDate;
                  const dayNum = format(date, "dd");
                  const dayName = format(date, "EEE");
                  return (
                    <>
                      <tr key={row.id} className="border-t first:border-t-0">
                        <td className="px-4 py-1.5 w-16 align-top">
                          <div className="font-semibold tabular-nums leading-none">
                            {dayNum}
                          </div>
                          <div className="text-[10px] uppercase text-muted-foreground leading-none mt-0.5">
                            {dayName}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          {row.showModule ? (
                            <>
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
                                Module {row.module.number}
                              </div>
                              <div className="font-medium leading-tight mt-0.5">
                                {row.module.name}
                              </div>
                            </>
                          ) : (
                            <div className="text-muted-foreground text-xs">
                              ↳ continued
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 w-28 text-right tabular-nums text-muted-foreground align-top">
                          {row.startTime}–{row.endTime}
                        </td>
                        <td className="px-4 py-1.5 w-12 text-right text-muted-foreground align-top">
                          {row.hours}h
                        </td>
                      </tr>
                      {row.autonomousHours != null ? (
                        <tr key={`${row.id}-hw`} className="border-t bg-orange-50/60 print:bg-zinc-50">
                          <td colSpan={2} className="px-4 py-1 text-xs italic text-muted-foreground">
                            + Homework — {row.autonomousHours}h trabalho autónomo
                          </td>
                          <td className="px-2 py-1" />
                          <td className="px-4 py-1 w-12 text-right text-muted-foreground">
                            {row.autonomousHours}h
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
