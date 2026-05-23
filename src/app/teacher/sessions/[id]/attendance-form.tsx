"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { markAttendanceAction } from "@/lib/actions/attendance";

type State = "PRESENT" | "LATE" | "LEFT_EARLY" | "EXCUSED_ABSENCE" | "UNEXCUSED_ABSENCE";

const OPTIONS: Array<{ key: State; label: string; cls: string }> = [
  { key: "PRESENT",            label: "Present",  cls: "chip chip-success" },
  { key: "LATE",               label: "Late",     cls: "chip chip-warning" },
  { key: "LEFT_EARLY",         label: "Left early", cls: "chip chip-accent" },
  { key: "EXCUSED_ABSENCE",    label: "Excused",  cls: "chip chip-info" },
  { key: "UNEXCUSED_ABSENCE",  label: "Absent",   cls: "chip chip-danger" },
];

type Row = {
  enrollmentId: string;
  studentName: string;
  state: State | null;
  notes: string;
};

export function AttendanceForm({
  sessionId,
  notes: initialNotes,
  rows: initialRows,
}: {
  sessionId: string;
  batchId: string;
  notes: string;
  rows: Row[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [notes, setNotes] = useState(initialNotes);
  const [rows, setRows] = useState<Row[]>(initialRows);

  function setRowState(enrollmentId: string, state: State) {
    setRows((prev) =>
      prev.map((r) => (r.enrollmentId === enrollmentId ? { ...r, state } : r)),
    );
  }

  function setAllTo(state: State) {
    setRows((prev) => prev.map((r) => ({ ...r, state })));
  }

  function setRowNotes(enrollmentId: string, note: string) {
    setRows((prev) =>
      prev.map((r) => (r.enrollmentId === enrollmentId ? { ...r, notes: note } : r)),
    );
  }

  const unmarked = rows.filter((r) => r.state === null).length;

  function save() {
    setError(null);
    if (unmarked > 0) {
      setError(`${unmarked} student${unmarked === 1 ? "" : "s"} still unmarked.`);
      return;
    }
    startTransition(async () => {
      const result = await markAttendanceAction({
        sessionId,
        notes: notes.trim() || null,
        entries: rows.map((r) => ({
          enrollmentId: r.enrollmentId,
          state: r.state as State,
          notes: r.notes.trim() || null,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(new Date());
      router.refresh();
    });
  }

  const counts = OPTIONS.reduce<Record<State, number>>(
    (acc, o) => ({ ...acc, [o.key]: rows.filter((r) => r.state === o.key).length }),
    { PRESENT: 0, LATE: 0, LEFT_EARLY: 0, EXCUSED_ABSENCE: 0, UNEXCUSED_ABSENCE: 0 } as Record<State, number>,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground sm:mr-1 block sm:inline">
          Mark all
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setAllTo(o.key)}
              className={`text-xs px-2 py-1 rounded-full border ${o.cls}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="block sm:ml-auto text-xs text-muted-foreground tabular-nums">
          {counts.PRESENT} present · {counts.LATE + counts.LEFT_EARLY} partial ·{" "}
          {counts.EXCUSED_ABSENCE + counts.UNEXCUSED_ABSENCE} absent
          {unmarked > 0 ? (
            <span className="ml-1 font-medium text-[var(--hz-warning)]">
              · {unmarked} unmarked
            </span>
          ) : null}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {rows.map((r) => (
          <AttendanceCard
            key={r.enrollmentId}
            row={r}
            onState={(state) => setRowState(r.enrollmentId, state)}
            onNote={(note) => setRowNotes(r.enrollmentId, note)}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Session notes (optional)
        </label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything notable about today's session…"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* Save bar — sticky on mobile so the CTA stays reachable while
          marking a long roster. */}
      <div
        className="sm:static sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 sm:py-0 hair-t sm:border-t-0"
        style={{
          background: "rgba(11,14,20,0.92)",
          backdropFilter: "saturate(140%) blur(8px)",
          paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom))`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {savedAt
              ? `Saved at ${savedAt.toLocaleTimeString()}`
              : unmarked > 0
                ? `${unmarked} student${unmarked === 1 ? "" : "s"} still unmarked`
                : null}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={pending || unmarked > 0}
            className="btn-primary"
            style={{ minHeight: 44 }}
          >
            {pending ? "Saving…" : "Save attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendanceCard({
  row,
  onState,
  onNote,
}: {
  row: Row;
  onState: (state: State) => void;
  onNote: (note: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(row.notes.length > 0);
  const unmarked = row.state === null;
  return (
    <div
      className={`rounded-lg border p-2.5 space-y-1.5 ${
        unmarked
          ? "border-dashed border-[var(--hz-warning)] bg-[var(--hz-warning-50)]"
          : "bg-card"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm truncate">{row.studentName}</div>
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          className={`text-[11px] px-1.5 py-0.5 rounded border transition shrink-0 ${
            row.notes.length > 0
              ? "bg-foreground text-background border-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
          aria-label={noteOpen ? "Hide note" : "Add note"}
        >
          {row.notes.length > 0 ? "Note •" : "+ Note"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {OPTIONS.map((o) => {
          const active = row.state === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onState(o.key)}
              className={`text-xs px-2 py-1 rounded-md border transition ${
                active
                  ? o.cls + " font-medium"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {noteOpen ? (
        <input
          type="text"
          value={row.notes}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Optional note…"
          autoFocus={row.notes.length === 0}
          className="w-full text-xs rounded-md border bg-muted px-2 py-1.5 placeholder:text-muted-foreground"
        />
      ) : null}
    </div>
  );
}
