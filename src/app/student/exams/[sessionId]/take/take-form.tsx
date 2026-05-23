"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitExamAnswersAction } from "@/lib/actions/exams";

type QuestionType = "MC" | "FILL" | "OPEN";

type Question = {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  points: number;
  choices: string[];
};

type Answer = {
  answerIndex: number | null;
  answerText: string;
};

// Honour-system take-exam UI. One scroll, all questions visible, timer at the
// top counts down from durationMinutes. The timer is visual — it does NOT
// enforce a deadline; the server doesn't time-gate either. Students who blow
// past the duration just see "Time's up" but can still submit. We rely on
// the scheduled-date window enforced on the page wrapper for hard gating.

export function TakeExamForm({
  sessionId,
  title,
  moduleNumber,
  moduleName,
  durationMinutes,
  totalPoints,
  questions,
}: {
  sessionId: string;
  title: string;
  moduleNumber: number;
  moduleName: string;
  durationMinutes: number;
  totalPoints: number;
  questions: Question[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Seed empty answers for every question. Keyed by questionId.
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => {
    const init: Record<string, Answer> = {};
    for (const q of questions) {
      init[q.id] = { answerIndex: null, answerText: "" };
    }
    return init;
  });

  function patchAnswer(qid: string, patch: Partial<Answer>) {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }

  // Timer: counts down from durationMinutes * 60 seconds. Starts on mount,
  // persists across re-renders via ref. When it hits 0, we don't auto-submit
  // (avoid the surprise lose-your-work case); we just paint it red.
  const startedAt = useRef<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsedSec = Math.floor((now - startedAt.current) / 1000);
  const remainingSec = Math.max(0, durationMinutes * 60 - elapsedSec);
  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const timerColor =
    remainingSec === 0
      ? "var(--hz-danger)"
      : remainingSec < 60
        ? "var(--hz-warning)"
        : "var(--hz-ink-2)";

  // Number of answered questions (anything non-blank counts).
  const answered = useMemo(() => {
    let n = 0;
    for (const q of questions) {
      const a = answers[q.id];
      if (q.type === "MC") {
        if (a.answerIndex !== null) n += 1;
      } else if (a.answerText.trim().length > 0) {
        n += 1;
      }
    }
    return n;
  }, [questions, answers]);

  function onSubmit() {
    setError(null);
    const unanswered = questions.length - answered;
    if (unanswered > 0) {
      // Soft warning — let them confirm before submitting incomplete.
      const ok = window.confirm(
        `You haven't answered ${unanswered} question${unanswered === 1 ? "" : "s"}. Submit anyway?`,
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const payload = questions.map((q) => ({
        questionId: q.id,
        answerIndex: answers[q.id].answerIndex,
        answerText: answers[q.id].answerText,
      }));
      const result = await submitExamAnswersAction({
        batchSessionId: sessionId,
        answers: payload,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/student/exams/${sessionId}/result`);
    });
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Sticky timer + meta strip */}
      <header
        className="sticky top-14 hz-card px-4 py-3 flex items-center gap-4 flex-wrap"
        style={{ background: "var(--hz-surface)", zIndex: 5 }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="hz-mono text-xs uppercase tracking-[.16em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Exam · M{moduleNumber} · {moduleName}
          </div>
          <h1 className="font-display text-xl font-medium mt-0.5 truncate">
            {title}
          </h1>
        </div>
        <div className="text-right">
          <div
            className="hz-mono text-xs uppercase tracking-[.16em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Time left
          </div>
          <div
            className="stat-num tabular-nums"
            style={{
              color: timerColor,
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              lineHeight: 1.1,
            }}
          >
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
          <div
            className="hz-mono text-xs"
            style={{ color: "var(--hz-ink-3)" }}
          >
            {answered} / {questions.length} answered · {totalPoints} pts
          </div>
        </div>
      </header>

      <ol className="space-y-3">
        {questions.map((q, idx) => (
          <li key={q.id} className="hz-card p-4 space-y-3">
            <header className="flex items-baseline gap-3">
              <span
                className="hz-mono text-xs"
                style={{ color: "var(--hz-ink-3)" }}
              >
                Q{idx + 1}
              </span>
              <div className="font-medium flex-1 leading-snug">
                {q.prompt}
              </div>
              <span
                className="hz-mono text-xs whitespace-nowrap"
                style={{ color: "var(--hz-ink-3)" }}
              >
                {q.points} pt{q.points === 1 ? "" : "s"}
              </span>
            </header>

            {q.type === "MC" ? (
              <ul className="space-y-1.5">
                {q.choices.map((choice, i) => {
                  const checked = answers[q.id].answerIndex === i;
                  return (
                    <li key={i}>
                      <label
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm cursor-pointer"
                        style={{
                          background: checked
                            ? "var(--hz-primary-50)"
                            : "var(--hz-surface-2)",
                          border: `1px solid ${checked ? "var(--hz-primary)" : "var(--hz-line)"}`,
                          transition: "background 100ms, border-color 100ms",
                        }}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={checked}
                          onChange={() => patchAnswer(q.id, { answerIndex: i })}
                          className="hz-cb"
                        />
                        <span>{choice}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : q.type === "FILL" ? (
              <Input
                value={answers[q.id].answerText}
                onChange={(e) => patchAnswer(q.id, { answerText: e.target.value })}
                placeholder="Your answer…"
                maxLength={500}
              />
            ) : (
              <Textarea
                value={answers[q.id].answerText}
                onChange={(e) => patchAnswer(q.id, { answerText: e.target.value })}
                rows={4}
                placeholder="Write your response…"
                maxLength={5000}
              />
            )}
          </li>
        ))}
      </ol>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className="sticky bottom-0 py-3 flex items-center justify-between gap-3 hair-t flex-wrap"
        style={{ background: "var(--hz-bg)" }}
      >
        <span
          className="hz-mono text-xs"
          style={{ color: "var(--hz-ink-3)" }}
        >
          {answered === questions.length
            ? "All questions answered."
            : `${questions.length - answered} unanswered.`}{" "}
          Submitting saves all answers and shows your auto-graded score.
        </span>
        <Button type="button" onClick={onSubmit} disabled={pending}>
          {pending ? "Submitting…" : "Submit exam"}
        </Button>
      </div>
    </div>
  );
}
