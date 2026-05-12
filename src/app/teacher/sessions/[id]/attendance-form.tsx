"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { markAttendanceAction } from "@/lib/actions/attendance";

type State = "PRESENT" | "LATE" | "LEFT_EARLY" | "EXCUSED_ABSENCE" | "UNEXCUSED_ABSENCE";

const OPTIONS: Array<{ key: State; label: string; cls: string }> = [
  { key: "PRESENT",            label: "Present",  cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { key: "LATE",               label: "Late",     cls: "bg-amber-100 text-amber-900 border-amber-300" },
  { key: "LEFT_EARLY",         label: "Left early", cls: "bg-orange-100 text-orange-900 border-orange-300" },
  { key: "EXCUSED_ABSENCE",    label: "Excused",  cls: "bg-blue-100 text-blue-900 border-blue-300" },
  { key: "UNEXCUSED_ABSENCE",  label: "Absent",   cls: "bg-red-100 text-red-900 border-red-300" },
];

type Row = {
  enrollmentId: string;
  studentName: string;
  state: State;
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

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await markAttendanceAction({
        sessionId,
        notes: notes.trim() || null,
        entries: rows.map((r) => ({
          enrollmentId: r.enrollmentId,
          state: r.state,
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
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">
          Mark all
        </span>
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
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {counts.PRESENT} present · {counts.LATE + counts.LEFT_EARLY} partial ·{" "}
          {counts.EXCUSED_ABSENCE + counts.UNEXCUSED_ABSENCE} absent
        </span>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.enrollmentId} className="rounded-lg border bg-white p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-medium">{r.studentName}</div>
              <div className="flex flex-wrap gap-1">
                {OPTIONS.map((o) => {
                  const active = r.state === o.key;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setRowState(r.enrollmentId, o.key)}
                      className={`text-xs px-2 py-1 rounded-md border transition ${
                        active
                          ? o.cls + " font-medium"
                          : "bg-white text-muted-foreground hover:bg-zinc-50"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <input
              type="text"
              value={r.notes}
              onChange={(e) => setRowNotes(r.enrollmentId, e.target.value)}
              placeholder="Optional note for this student…"
              className="w-full text-xs rounded-md border bg-zinc-50/40 px-2 py-1.5 placeholder:text-muted-foreground"
            />
          </li>
        ))}
      </ul>

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
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {savedAt ? `Saved at ${savedAt.toLocaleTimeString()}` : null}
        </p>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save attendance"}
        </Button>
      </div>
    </div>
  );
}
