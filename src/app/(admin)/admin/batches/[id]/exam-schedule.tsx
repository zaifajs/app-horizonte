"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scheduleExamSessionAction } from "@/lib/actions/exams";

// "Module exams" section. Rendered on both admin and teacher batch detail.
// One row per module showing: exam title + question count, current
// schedule state, and a button to schedule / reschedule. The schedule
// button opens an inline dialog; on save it fires the server action that
// creates (or updates) the EXAM-kind BatchSession.

export type ExamScheduleRow = {
  moduleId: string;
  moduleNumber: number;
  moduleName: string;
  // Null when the module's exam hasn't been authored yet.
  exam: {
    id: string;
    title: string;
    questionCount: number;
    durationMinutes: number;
  } | null;
  // The scheduled EXAM session for this batch+module, if any.
  scheduled: {
    sessionId: string;
    scheduledDate: string; // YYYY-MM-DD
    startTime: string | null;
  } | null;
};

export function ExamSchedule({
  batchId,
  rows,
  canSchedule,
}: {
  batchId: string;
  rows: ExamScheduleRow[];
  canSchedule: boolean;
}) {
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="section-title">Module exams</h2>
        <div style={{ flex: 1, height: 1, background: "var(--hz-line)" }} />
        <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
          {rows.filter((r) => r.scheduled).length} / {rows.length} scheduled
        </span>
      </div>

      <div className="hz-card overflow-hidden">
        <ul className="divide-y" style={{ borderColor: "var(--hz-line)" }}>
          {rows.map((row) => (
            <li
              key={row.moduleId}
              className="px-4 py-3"
              style={{ borderColor: "var(--hz-line)" }}
            >
              <ExamRow
                batchId={batchId}
                row={row}
                canSchedule={canSchedule}
                isEditing={editingModuleId === row.moduleId}
                onStartEdit={() => setEditingModuleId(row.moduleId)}
                onClose={() => setEditingModuleId(null)}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ExamRow({
  batchId,
  row,
  canSchedule,
  isEditing,
  onStartEdit,
  onClose,
}: {
  batchId: string;
  row: ExamScheduleRow;
  canSchedule: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(row.scheduled?.scheduledDate ?? "");
  const [startTime, setStartTime] = useState(
    row.scheduled?.startTime ?? "14:00",
  );
  const [duration, setDuration] = useState(
    String(row.exam?.durationMinutes ?? 45),
  );

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await scheduleExamSessionAction({
        batchId,
        moduleId: row.moduleId,
        scheduledDate: date,
        startTime,
        durationMinutes: Number(duration),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const noExam = row.exam === null || row.exam.questionCount === 0;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span
        className="hz-mono text-xs font-semibold"
        style={{
          color: "var(--hz-ink-3)",
          width: 56,
          letterSpacing: "0.14em",
        }}
      >
        M{row.moduleNumber}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{row.exam?.title ?? row.moduleName}</div>
        <div
          className="hz-mono text-xs mt-0.5"
          style={{ color: "var(--hz-ink-3)" }}
        >
          {row.exam ? `${row.exam.questionCount} questions` : "No exam authored yet"}
          {row.scheduled ? (
            <>
              <span className="mx-1.5">·</span>
              <span style={{ color: "var(--hz-primary)" }}>
                Scheduled {format(
                  // Date string is YYYY-MM-DD — parse as UTC midnight so the
                  // displayed day doesn't shift in TZs west of UTC.
                  new Date(`${row.scheduled.scheduledDate}T00:00:00.000Z`),
                  "EEE dd MMM",
                )}
                {row.scheduled.startTime ? ` · ${row.scheduled.startTime}` : ""}
              </span>
            </>
          ) : (
            <>
              <span className="mx-1.5">·</span>
              <span style={{ color: "var(--hz-warning)" }}>Not scheduled</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {noExam ? (
          <Link
            href={`/admin/exams/${row.moduleId}`}
            className="btn-ghost text-xs"
            title="Author the exam first — then it can be scheduled"
          >
            Author exam
          </Link>
        ) : (
          <>
            {row.scheduled ? (
              <Link
                href={`/teacher/exams/${row.scheduled.sessionId}/grade`}
                className="btn-ghost text-xs"
                title="Open the grading queue for this exam session"
              >
                Grade
              </Link>
            ) : null}
            {canSchedule && !isEditing ? (
              <Button
                type="button"
                variant="outline"
                onClick={onStartEdit}
              >
                {row.scheduled ? "Reschedule" : "Schedule"}
              </Button>
            ) : null}
          </>
        )}
      </div>

      {isEditing ? (
        <div
          className="basis-full mt-3 rounded-md p-3 grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-end"
          style={{
            background: "var(--hz-surface-2)",
            border: "1px solid var(--hz-line)",
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`d-${row.moduleId}`}>Date</Label>
            <Input
              id={`d-${row.moduleId}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`t-${row.moduleId}`}>Start time</Label>
            <Input
              id={`t-${row.moduleId}`}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`m-${row.moduleId}`}>Duration (m)</Label>
            <Input
              id={`m-${row.moduleId}`}
              type="number"
              min={1}
              max={360}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={pending || !date}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          {error ? (
            <p className="col-span-5 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
