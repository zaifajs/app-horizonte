"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gradeExamSubmissionAction } from "@/lib/actions/exams";

type QuestionType = "MC" | "FILL" | "OPEN";

export type GradingQuestion = {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  points: number;
  choices: string[];
  correctIndex: number | null;
  acceptedAnswers: string[];
};

export type GradingAnswer = {
  id: string;
  questionId: string;
  answerIndex: number | null;
  answerText: string | null;
  pointsAwarded: number | null;
};

export type GradingSubmission = {
  id: string;
  studentName: string;
  studentEmail: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  startedAt: string;
  submittedAt: string | null;
  autoScore: number | null;
  teacherScore: number | null;
  answers: GradingAnswer[];
};

// Per-submission "tab" pattern: left column lists submissions, right column
// is the expanded view of the currently-selected submission with each
// question + the student's answer + (for OPEN) a points input.

export function GradingForm({
  questions,
  submissions,
  totalPoints,
  passingScore,
}: {
  questions: GradingQuestion[];
  submissions: GradingSubmission[];
  totalPoints: number;
  passingScore: number;
}) {
  // Map for fast lookups question-by-id.
  const qById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );
  const passThreshold = Math.ceil((totalPoints * passingScore) / 100);

  // Pick the first not-yet-graded SUBMITTED submission as the default focus.
  const firstUngraded =
    submissions.find((s) => s.status === "SUBMITTED")?.id ??
    submissions[0]?.id ??
    null;
  const [selectedId, setSelectedId] = useState<string | null>(firstUngraded);
  const selected = submissions.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <aside className="hz-card overflow-hidden">
        <div
          className="px-3 py-2 hair-b text-xs hz-mono uppercase tracking-[.14em]"
          style={{ color: "var(--hz-ink-3)" }}
        >
          Submissions · {submissions.length}
        </div>
        <ul>
          {submissions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2 hair-b transition-colors"
                style={{
                  background:
                    selectedId === s.id ? "var(--hz-surface-2)" : "transparent",
                  borderLeftWidth: 3,
                  borderLeftStyle: "solid",
                  borderLeftColor:
                    selectedId === s.id
                      ? "var(--hz-primary)"
                      : "transparent",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.studentName}
                  </div>
                  <div
                    className="hz-mono text-xs mt-0.5"
                    style={{ color: "var(--hz-ink-3)" }}
                  >
                    {s.status === "GRADED" ? (
                      <span style={{ color: "var(--hz-success)" }}>
                        Graded · {(s.autoScore ?? 0) + (s.teacherScore ?? 0)}/{totalPoints}
                      </span>
                    ) : s.status === "SUBMITTED" ? (
                      <span style={{ color: "var(--hz-warning)" }}>
                        Needs grading · auto {s.autoScore ?? 0}/{totalPoints}
                      </span>
                    ) : (
                      <span>In progress</span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {selected ? (
        <SubmissionDetail
          key={selected.id}
          submission={selected}
          questions={questions}
          qById={qById}
          totalPoints={totalPoints}
          passThreshold={passThreshold}
        />
      ) : (
        <div
          className="rounded-lg border border-dashed p-10 text-center hz-mono text-sm"
          style={{ color: "var(--hz-ink-3)", borderColor: "var(--hz-line)" }}
        >
          Pick a submission on the left.
        </div>
      )}
    </div>
  );
}

function SubmissionDetail({
  submission,
  questions,
  qById,
  totalPoints,
  passThreshold,
}: {
  submission: GradingSubmission;
  questions: GradingQuestion[];
  qById: Map<string, GradingQuestion>;
  totalPoints: number;
  passThreshold: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local state for the OPEN question points the teacher is editing. Keyed by
  // answer id; seeded from the current pointsAwarded.
  const initialDrafts = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of submission.answers) {
      const q = qById.get(a.questionId);
      if (q?.type === "OPEN") {
        m[a.id] = a.pointsAwarded != null ? String(a.pointsAwarded) : "";
      }
    }
    return m;
  }, [submission.answers, qById]);
  const [drafts, setDrafts] = useState<Record<string, string>>(initialDrafts);

  // For the running total preview at the top.
  const openTotalNow = submission.answers.reduce((acc, a) => {
    const q = qById.get(a.questionId);
    if (q?.type !== "OPEN") return acc;
    const draft = drafts[a.id];
    const value = draft !== undefined && draft !== "" ? Number(draft) : a.pointsAwarded;
    return acc + (Number.isFinite(value) ? (value as number) : 0);
  }, 0);
  const provisionalTotal = (submission.autoScore ?? 0) + openTotalNow;
  const wouldPass = provisionalTotal >= passThreshold;

  function onSave() {
    setError(null);
    const grades: { answerId: string; pointsAwarded: number }[] = [];
    for (const a of submission.answers) {
      const q = qById.get(a.questionId);
      if (q?.type !== "OPEN") continue;
      const raw = drafts[a.id];
      if (raw === undefined || raw === "") {
        setError("All open-response questions need a points value.");
        return;
      }
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        setError("Points must be a non-negative whole number.");
        return;
      }
      if (n > q.points) {
        setError(`Max for "${q.prompt.slice(0, 32)}…" is ${q.points} points.`);
        return;
      }
      grades.push({ answerId: a.id, pointsAwarded: n });
    }
    startTransition(async () => {
      const result = await gradeExamSubmissionAction({
        submissionId: submission.id,
        grades,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const canEdit = submission.status === "SUBMITTED" || submission.status === "GRADED";
  const hasOpen = submission.answers.some(
    (a) => qById.get(a.questionId)?.type === "OPEN",
  );

  return (
    <div className="space-y-3">
      {/* Header strip with student name + provisional total. */}
      <header
        className="hz-card p-4 flex items-center gap-4 flex-wrap"
        style={{
          borderColor:
            submission.status === "GRADED"
              ? "var(--hz-success)"
              : "var(--hz-line)",
        }}
      >
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl font-medium truncate">
            {submission.studentName}
          </h2>
          <p
            className="hz-mono text-xs mt-0.5"
            style={{ color: "var(--hz-ink-3)" }}
          >
            {submission.studentEmail}
            {submission.submittedAt ? (
              <>
                <span className="mx-1.5">·</span>
                submitted {new Date(submission.submittedAt).toLocaleString()}
              </>
            ) : null}
          </p>
        </div>
        <div className="text-right">
          <div
            className="stat-num"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.75rem",
              color: wouldPass ? "var(--hz-success)" : "var(--hz-warning)",
              lineHeight: 1.1,
            }}
          >
            {provisionalTotal}
            <span
              className="hz-mono text-base ml-1"
              style={{ color: "var(--hz-ink-3)" }}
            >
              / {totalPoints}
            </span>
          </div>
          <div
            className="hz-mono text-xs mt-0.5"
            style={{ color: wouldPass ? "var(--hz-success)" : "var(--hz-warning)" }}
          >
            {wouldPass ? "Passes" : `Needs ${passThreshold - provisionalTotal}+ to pass`}
          </div>
        </div>
      </header>

      <ol className="space-y-3">
        {questions.map((q, idx) => {
          const answer = submission.answers.find((a) => a.questionId === q.id);
          return (
            <li key={q.id} className="hz-card p-4 space-y-2">
              <div className="flex items-baseline gap-3">
                <span
                  className="hz-mono text-xs"
                  style={{ color: "var(--hz-ink-3)" }}
                >
                  Q{idx + 1}
                </span>
                <span className="chip chip-outline">
                  {q.type === "MC" ? "MC" : q.type === "FILL" ? "Fill" : "Open"}
                </span>
                <div className="font-medium flex-1">{q.prompt}</div>
                <span
                  className="hz-mono text-xs whitespace-nowrap"
                  style={{ color: "var(--hz-ink-3)" }}
                >
                  {q.points} pt{q.points === 1 ? "" : "s"}
                </span>
              </div>

              {q.type === "MC" ? (
                <McAnswer
                  question={q}
                  studentChoice={answer?.answerIndex ?? null}
                  awarded={answer?.pointsAwarded ?? null}
                />
              ) : q.type === "FILL" ? (
                <FillAnswer
                  question={q}
                  studentAnswer={answer?.answerText ?? null}
                  awarded={answer?.pointsAwarded ?? null}
                />
              ) : (
                <OpenAnswer
                  question={q}
                  studentAnswer={answer?.answerText ?? null}
                  awardedDraft={answer ? drafts[answer.id] ?? "" : ""}
                  onAwardedChange={(value) => {
                    if (!answer) return;
                    setDrafts((prev) => ({ ...prev, [answer.id]: value }));
                  }}
                  canEdit={canEdit}
                />
              )}
            </li>
          );
        })}
      </ol>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {hasOpen && canEdit ? (
        <div
          className="flex items-center justify-end gap-3 sticky bottom-0 py-3 hair-t"
          style={{ background: "var(--hz-bg)" }}
        >
          <span
            className="hz-mono text-xs"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Saving marks the submission as Graded.
          </span>
          <Button type="button" onClick={onSave} disabled={pending}>
            {pending ? "Saving…" : "Save grades"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function McAnswer({
  question,
  studentChoice,
  awarded,
}: {
  question: GradingQuestion;
  studentChoice: number | null;
  awarded: number | null;
}) {
  return (
    <div className="space-y-1.5">
      <ul className="space-y-1.5">
        {question.choices.map((c, i) => {
          const isStudent = studentChoice === i;
          const isCorrect = question.correctIndex === i;
          return (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              style={{
                background: isStudent ? "var(--hz-surface-2)" : "transparent",
                border: `1px solid ${isCorrect ? "var(--hz-success)" : "var(--hz-line)"}`,
              }}
            >
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                style={{
                  border: `1.5px solid ${isStudent ? "var(--hz-primary)" : "var(--hz-line)"}`,
                  background: isStudent ? "var(--hz-primary)" : "transparent",
                }}
              />
              <span style={{ color: isCorrect ? "var(--hz-success)" : "var(--hz-ink)" }}>
                {c}
              </span>
              {isStudent ? (
                <span
                  className="hz-mono text-xs ml-auto"
                  style={{
                    color: isCorrect ? "var(--hz-success)" : "var(--hz-danger)",
                  }}
                >
                  {isCorrect ? "Correct" : "Student picked"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p
        className="hz-mono text-xs mt-1"
        style={{ color: "var(--hz-ink-3)" }}
      >
        Auto-graded: {awarded ?? 0} / {question.points}
      </p>
    </div>
  );
}

function FillAnswer({
  question,
  studentAnswer,
  awarded,
}: {
  question: GradingQuestion;
  studentAnswer: string | null;
  awarded: number | null;
}) {
  const correct = (awarded ?? 0) > 0;
  return (
    <div className="space-y-1.5">
      <div
        className="rounded-md px-3 py-2 hz-mono text-sm"
        style={{
          background: "var(--hz-surface-2)",
          border: `1px solid ${correct ? "var(--hz-success)" : "var(--hz-line)"}`,
          color: correct ? "var(--hz-success)" : "var(--hz-ink)",
        }}
      >
        {studentAnswer && studentAnswer.length > 0 ? studentAnswer : "(blank)"}
      </div>
      <p
        className="hz-mono text-xs mt-1"
        style={{ color: "var(--hz-ink-3)" }}
      >
        Accepted: {question.acceptedAnswers.join(" · ")} · Auto-graded:{" "}
        {awarded ?? 0} / {question.points}
      </p>
    </div>
  );
}

function OpenAnswer({
  question,
  studentAnswer,
  awardedDraft,
  onAwardedChange,
  canEdit,
}: {
  question: GradingQuestion;
  studentAnswer: string | null;
  awardedDraft: string;
  onAwardedChange: (value: string) => void;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div
        className="rounded-md px-3 py-2 text-sm whitespace-pre-wrap"
        style={{
          background: "var(--hz-surface-2)",
          border: "1px solid var(--hz-line)",
          color: "var(--hz-ink)",
          minHeight: 60,
        }}
      >
        {studentAnswer && studentAnswer.length > 0 ? studentAnswer : "(blank)"}
      </div>
      <div className="flex items-center gap-2">
        <label
          className="hz-mono text-xs"
          style={{ color: "var(--hz-ink-3)" }}
        >
          Points awarded
        </label>
        <Input
          type="number"
          min={0}
          max={question.points}
          value={awardedDraft}
          onChange={(e) => onAwardedChange(e.target.value)}
          disabled={!canEdit}
          style={{ width: 80 }}
        />
        <span
          className="hz-mono text-xs"
          style={{ color: "var(--hz-ink-3)" }}
        >
          / {question.points}
        </span>
      </div>
    </div>
  );
}
