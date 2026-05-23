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

const CELL: Record<AttendanceState, { code: string; tone: string; label: string }> = {
  PRESENT: { code: "P", tone: "var(--hz-success)", label: "Present" },
  LATE: { code: "L", tone: "var(--hz-warning)", label: "Late" },
  LEFT_EARLY: { code: "E", tone: "var(--hz-accent)", label: "Left early" },
  EXCUSED_ABSENCE: { code: "X", tone: "var(--hz-info)", label: "Excused" },
  UNEXCUSED_ABSENCE: { code: "A", tone: "var(--hz-danger)", label: "Absent" },
};

function CellChip({ value }: { value: Cell }) {
  if (!value) {
    return (
      <span
        title="Not marked"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-xs hz-mono"
        style={{
          border: "1px dashed var(--hz-line)",
          color: "var(--hz-ink-3)",
        }}
      >
        —
      </span>
    );
  }
  const c = CELL[value];
  return (
    <span
      title={c.label}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-xs font-semibold tabular-nums hz-mono"
      style={{
        color: c.tone,
        background: "transparent",
        border: `1px solid ${c.tone}`,
      }}
    >
      {c.code}
    </span>
  );
}

function presentPct(cells: Cell[]): string {
  const marked = cells.filter((c) => c !== null);
  if (marked.length === 0) return "—";
  const present = marked.filter(
    (c) => c === "PRESENT" || c === "LATE" || c === "LEFT_EARLY",
  ).length;
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
      <div className="flex items-center gap-3 flex-wrap">
        <div className="seg">
          <Link
            href={`${basePath}?layout=students`}
            className={layout === "students" ? "on" : ""}
          >
            Students × Sessions
          </Link>
          <Link
            href={`${basePath}?layout=sessions`}
            className={layout === "sessions" ? "on" : ""}
          >
            Sessions × Students
          </Link>
        </div>
        <div
          className="ml-auto flex items-center gap-3 hz-mono text-xs"
          style={{ color: "var(--hz-ink-3)" }}
        >
          {Object.entries(CELL).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ border: `1px solid ${v.tone}` }}
              />
              {v.label}
            </span>
          ))}
        </div>
      </div>

      {students.length === 0 ? (
        <p
          className="rounded-lg border border-dashed p-6 text-center hz-mono text-sm"
          style={{ borderColor: "var(--hz-line)", color: "var(--hz-ink-3)" }}
        >
          No enrolled students.
        </p>
      ) : sessions.length === 0 ? (
        <p
          className="rounded-lg border border-dashed p-6 text-center hz-mono text-sm"
          style={{ borderColor: "var(--hz-line)", color: "var(--hz-ink-3)" }}
        >
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
    <div className="hz-card overflow-auto">
      <table className="text-xs">
        <thead style={{ background: "var(--hz-surface-2)" }}>
          <tr>
            <th
              className="sticky left-0 z-10 text-left px-3 py-2 font-medium hz-mono uppercase tracking-[.14em]"
              style={{
                background: "var(--hz-surface-2)",
                borderRight: "1px solid var(--hz-line)",
                color: "var(--hz-ink-3)",
                minWidth: 180,
              }}
            >
              Student
            </th>
            {sessions.map((s) => (
              <th
                key={s.id}
                className="px-1 py-2 font-medium text-center whitespace-nowrap"
                style={{ color: "var(--hz-ink-3)" }}
              >
                <div className="text-xs hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                  M{s.moduleNumber}
                </div>
                <div className="hz-mono">{format(s.scheduledDate, "dd MMM")}</div>
              </th>
            ))}
            <th
              className="sticky right-0 z-10 px-3 py-2 font-medium text-center hz-mono uppercase tracking-[.14em]"
              style={{
                background: "var(--hz-surface-2)",
                borderLeft: "1px solid var(--hz-line)",
                color: "var(--hz-ink-3)",
              }}
            >
              Rate
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((st) => {
            const row = sessions.map((s) => get(st.enrollmentId, s.id));
            return (
              <tr
                key={st.enrollmentId}
                style={{ borderTop: "1px solid var(--hz-line)" }}
              >
                <td
                  className="sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap"
                  style={{
                    background: "var(--hz-surface)",
                    borderRight: "1px solid var(--hz-line)",
                  }}
                >
                  {st.fullName}
                </td>
                {row.map((c, i) => (
                  <td key={sessions[i].id} className="px-1 py-1 text-center">
                    <CellChip value={c} />
                  </td>
                ))}
                <td
                  className="sticky right-0 z-10 px-3 py-1.5 text-center font-medium tabular-nums hz-mono"
                  style={{
                    background: "var(--hz-surface)",
                    borderLeft: "1px solid var(--hz-line)",
                  }}
                >
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
    <div className="hz-card overflow-auto">
      <table className="text-xs">
        <thead style={{ background: "var(--hz-surface-2)" }}>
          <tr>
            <th
              className="sticky left-0 z-10 text-left px-3 py-2 font-medium hz-mono uppercase tracking-[.14em]"
              style={{
                background: "var(--hz-surface-2)",
                borderRight: "1px solid var(--hz-line)",
                color: "var(--hz-ink-3)",
                minWidth: 140,
              }}
            >
              Session
            </th>
            {students.map((st) => (
              <th
                key={st.enrollmentId}
                className="px-1 py-2 font-medium text-center whitespace-nowrap truncate"
                style={{ color: "var(--hz-ink-3)", maxWidth: 100 }}
              >
                {st.fullName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const row = students.map((st) => get(st.enrollmentId, s.id));
            return (
              <tr key={s.id} style={{ borderTop: "1px solid var(--hz-line)" }}>
                <td
                  className="sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap"
                  style={{
                    background: "var(--hz-surface)",
                    borderRight: "1px solid var(--hz-line)",
                  }}
                >
                  <div className="text-xs hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                    M{s.moduleNumber}
                  </div>
                  <div className="hz-mono">{format(s.scheduledDate, "EEE dd MMM")}</div>
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
