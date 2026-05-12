import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

// Print-friendly classic cronograma table (matches the existing PDF layout):
//   Formadores · Módulos · Datas · H. Início
//
// Used as a secondary view from /admin/batches/[id]?view=table (or ?print=1
// for browser print). Plain HTML/CSS — Tailwind classes that the print stylesheet
// can collapse if needed.

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
  const classroom = batch.sessions.filter((s) => s.kind === "CLASSROOM");
  const autonomousByModule = new Map(
    batch.sessions
      .filter((s) => s.kind === "AUTONOMOUS")
      .map((s) => [s.module.id, s]),
  );
  const totalHours =
    classroom.reduce((a, b) => a + b.hours, 0) +
    Array.from(autonomousByModule.values()).reduce((a, b) => a + b.hours, 0);

  // Group classroom rows by module to compute rowSpans for the Módulos column.
  const grouped = new Map<string, { module: Session["module"]; rows: Session[] }>();
  for (const s of classroom) {
    const g = grouped.get(s.module.id) ?? { module: s.module, rows: [] };
    g.rows.push(s);
    grouped.set(s.module.id, g);
  }
  const moduleGroups = Array.from(grouped.values()).sort(
    (a, b) => a.module.number - b.module.number,
  );

  // Total rows for the trainer column rowSpan (all classroom + all autonomous).
  const trainerRowSpan = batch.sessions.length;

  return (
    <div className={isPrint ? "p-6 bg-white text-zinc-900" : "space-y-4"}>
      {!isPrint ? (
        <div className="flex items-center justify-between print:hidden">
          <h1 className="text-lg font-semibold">Schedule table — {batch.code}</h1>
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
        <div className="text-center border-b py-3 print:py-2">
          <div className="text-base font-semibold text-blue-700 print:text-black">
            Cronograma — {batch.course.name}{" "}
            <span className="font-normal">· nível {batch.course.level}</span>
          </div>
          <div className="text-sm">Turma {batch.code}</div>
          <div className="text-xs text-muted-foreground">
            Período: {format(batch.startDate, "dd 'de' MMMM 'de' yyyy")} a{" "}
            {classroom[classroom.length - 1]
              ? format(classroom[classroom.length - 1].scheduledDate, "dd 'de' MMMM 'de' yyyy")
              : "—"}
            {" "}({totalHours} horas)
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide">
            <tr className="border-b">
              <th className="text-left px-3 py-2 border-r">Formadores/as</th>
              <th className="text-left px-3 py-2 border-r">Módulos</th>
              <th className="text-left px-3 py-2 border-r">Datas</th>
              <th className="text-left px-3 py-2">H. Início</th>
            </tr>
          </thead>
          <tbody>
            {moduleGroups.map((g, gIdx) => {
              const auto = autonomousByModule.get(g.module.id);
              const span = g.rows.length + (auto ? 1 : 0);
              return (
                <FragmentRows
                  key={g.module.id}
                  trainerName={
                    gIdx === 0 ? batch.trainer?.name ?? "Unassigned" : null
                  }
                  trainerRowSpan={gIdx === 0 ? trainerRowSpan : 0}
                  moduleName={g.module.name}
                  moduleRowSpan={span}
                  classroom={g.rows}
                  autonomous={auto ?? null}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRows({
  trainerName,
  trainerRowSpan,
  moduleName,
  moduleRowSpan,
  classroom,
  autonomous,
}: {
  trainerName: string | null;
  trainerRowSpan: number;
  moduleName: string;
  moduleRowSpan: number;
  classroom: Session[];
  autonomous: Session | null;
}) {
  return (
    <>
      {classroom.map((s, i) => (
        <tr key={s.id} className="border-b">
          {i === 0 && trainerName !== null ? (
            <td
              className="text-center px-3 py-2 border-r align-middle font-medium"
              rowSpan={trainerRowSpan}
            >
              {trainerName}
            </td>
          ) : null}
          {i === 0 ? (
            <td
              className="text-center px-3 py-2 border-r align-middle font-semibold"
              rowSpan={moduleRowSpan}
            >
              {moduleName}
            </td>
          ) : null}
          <td className="px-3 py-2 border-r">
            {format(s.scheduledDate, "dd/MM/yyyy")} ({format(s.scheduledDate, "EEE")})
          </td>
          <td className="px-3 py-2">
            {s.startTime}–{s.endTime}
          </td>
        </tr>
      ))}
      {autonomous ? (
        <tr className="bg-orange-50 border-b">
          <td
            colSpan={2}
            className="px-3 py-2 text-center italic text-muted-foreground"
          >
            {autonomous.hours}h trabalho autónomo
          </td>
        </tr>
      ) : null}
    </>
  );
}
