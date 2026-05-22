import Link from "next/link";
import { format } from "date-fns";
import { AttendanceState } from "@prisma/client";

type Layout = "students" | "sessions";

type SessionCol = {
  id: string;
  scheduledDate: Date;
  moduleNumber: number;
};

type StudentRow = {
  enrollmentId: string;
  fullName: string;
};

type Cell = AttendanceState | null;

const CELL: Record<AttendanceState, { code: string; cls: string; label: string }> = {
  PRESENT: { code: "P", cls: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Present" },
  LATE: { code: "L", cls: "bg-amber-100 text-amber-800 border-amber-200", label: "Late" },
  LEFT_EARLY: { code: "E", cls: "bg-orange-100 text-orange-800 border-orange-200", label: "Left early" },
  EXCUSED_ABSENCE: { code: "X", cls: "bg-blue-100 text-blue-800 border-blue-200", label: "Excused" },
  UNEXCUSED_ABSENCE: { code: "A", cls: "bg-red-100 text-red-800 border-red-200", label: "Absent" },
};

function CellChip({ value }: { value: Cell }) {
  if (!value) {
    return (
      <span
        title="Not marked"
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-dashed border-zinc-300 text-[10px] text-muted-foreground"
      >
        —
      </span>
    );
  }
  const c = CELL[value];
  return (
    <span
      title={c.label}
      className={`inline-flex h-6 w-6 items-center justify-center rounded border text-[11px] font-semibold tabular-nums ${c.cls}`}
    >
      {c.code}
    </span>
  );
}

function presentPct(cells: Cell[]): string {
  const marked = cells.filter((c) => c !== null);
  if (marked.length === 0) return "—";
  const present = marked.filter((c) => c === "PRESENT" || c === "LATE" || c === "LEFT_EARLY").length;
  return `${Math.round((present / marked.length) * 100)}%`;
}

export function AttendanceMatrix({
  basePath,
  layout,
  students,
  sessions,
  cells,
}: {
  basePath: string;
  layout: Layout;
  students: StudentRow[];
  sessions: SessionCol[];
  cells: Map<string, AttendanceState>;
}) {
  const get = (enrollmentId: string, sessionId: string): Cell =>
    cells.get(`${enrollmentId}|${sessionId}`) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Layout:</span>
        <Link
          href={`${basePath}?layout=students`}
          className={`px-2 py-1 rounded-md border text-xs ${
            layout === "students" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white"
          }`}
        >
          Students × Sessions
        </Link>
        <Link
          href={`${basePath}?layout=sessions`}
          className={`px-2 py-1 rounded-md border text-xs ${
            layout === "sessions" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white"
          }`}
        >
          Sessions × Students
        </Link>
        <span className="ml-auto text-xs text-muted-foreground">
          {Object.entries(CELL).map(([k, v]) => (
            <span key={k} className="mr-2 inline-flex items-center gap-1">
              <span className={`inline-block h-3 w-3 rounded-sm border ${v.cls}`} />
              {v.label}
            </span>
          ))}
        </span>
      </div>

      {students.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No enrolled students.
        </p>
      ) : sessions.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No classroom sessions scheduled.
        </p>
      ) : layout === "students" ? (
        <StudentsBySessions students={students} sessions={sessions} get={get} />
      ) : (
        <SessionsByStudents students={students} sessions={sessions} get={get} />
      )}
    </div>
  );
}

function StudentsBySessions({
  students,
  sessions,
  get,
}: {
  students: StudentRow[];
  sessions: SessionCol[];
  get: (enrollmentId: string, sessionId: string) => Cell;
}) {
  return (
    <div className="rounded-lg border bg-white overflow-auto">
      <table className="text-xs">
        <thead className="bg-zinc-50">
          <tr>
            <th className="sticky left-0 z-10 bg-zinc-50 text-left px-3 py-2 font-medium border-r min-w-[180px]">
              Student
            </th>
            {sessions.map((s) => (
              <th key={s.id} className="px-1 py-2 font-medium text-center whitespace-nowrap">
                <div className="text-[10px] text-muted-foreground">M{s.moduleNumber}</div>
                <div>{format(s.scheduledDate, "dd MMM")}</div>
              </th>
            ))}
            <th className="sticky right-0 z-10 bg-zinc-50 px-3 py-2 font-medium text-center border-l">
              Rate
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((st) => {
            const row = sessions.map((s) => get(st.enrollmentId, s.id));
            return (
              <tr key={st.enrollmentId} className="border-t hover:bg-zinc-50/60">
                <td className="sticky left-0 z-10 bg-white hover:bg-zinc-50/60 px-3 py-1.5 border-r whitespace-nowrap">
                  {st.fullName}
                </td>
                {row.map((c, i) => (
                  <td key={sessions[i].id} className="px-1 py-1 text-center">
                    <CellChip value={c} />
                  </td>
                ))}
                <td className="sticky right-0 z-10 bg-white px-3 py-1.5 border-l text-center font-medium tabular-nums">
                  {presentPct(row)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SessionsByStudents({
  students,
  sessions,
  get,
}: {
  students: StudentRow[];
  sessions: SessionCol[];
  get: (enrollmentId: string, sessionId: string) => Cell;
}) {
  return (
    <div className="rounded-lg border bg-white overflow-auto">
      <table className="text-xs">
        <thead className="bg-zinc-50">
          <tr>
            <th className="sticky left-0 z-10 bg-zinc-50 text-left px-3 py-2 font-medium border-r min-w-[140px]">
              Session
            </th>
            {students.map((st) => (
              <th key={st.enrollmentId} className="px-1 py-2 font-medium text-center whitespace-nowrap max-w-[100px] truncate">
                {st.fullName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const row = students.map((st) => get(st.enrollmentId, s.id));
            return (
              <tr key={s.id} className="border-t hover:bg-zinc-50/60">
                <td className="sticky left-0 z-10 bg-white hover:bg-zinc-50/60 px-3 py-1.5 border-r whitespace-nowrap">
                  <div className="text-[10px] text-muted-foreground">M{s.moduleNumber}</div>
                  <div>{format(s.scheduledDate, "EEE dd MMM")}</div>
                </td>
                {row.map((c, i) => (
                  <td key={students[i].enrollmentId} className="px-1 py-1 text-center">
                    <CellChip value={c} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function parseLayout(raw: string | undefined): Layout {
  return raw === "sessions" ? "sessions" : "students";
}
