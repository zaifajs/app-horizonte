"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveExamAction } from "@/lib/actions/exams";

type QuestionType = "MC" | "FILL" | "OPEN";

type Question = {
  id?: string;
  position: number;
  type: QuestionType;
  prompt: string;
  points: number;
  choices: string[];
  correctIndex: number | null;
  acceptedAnswers: string[];
};

type Initial = {
  moduleId: string;
  title: string;
  passingScore: number;
  durationMinutes: number;
  questions: Question[];
};

const TYPE_LABEL: Record<QuestionType, string> = {
  MC: "Multiple choice",
  FILL: "Fill in the blank",
  OPEN: "Open response",
};

// Defaults for newly-added questions of each type.
function newQuestion(type: QuestionType): Question {
  if (type === "MC") {
    return {
      position: 0,
      type,
      prompt: "",
      points: 1,
      choices: ["", ""],
      correctIndex: 0,
      acceptedAnswers: [],
    };
  }
  if (type === "FILL") {
    return {
      position: 0,
      type,
      prompt: "",
      points: 1,
      choices: [],
      correctIndex: null,
      acceptedAnswers: [""],
    };
  }
  return {
    position: 0,
    type,
    prompt: "",
    points: 1,
    choices: [],
    correctIndex: null,
    acceptedAnswers: [],
  };
}

export function ExamEditor({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [title, setTitle] = useState(initial.title);
  const [passingScore, setPassingScore] = useState(String(initial.passingScore));
  const [durationMinutes, setDurationMinutes] = useState(
    String(initial.durationMinutes),
  );
  const [questions, setQuestions] = useState<Question[]>(initial.questions);

  const totalPoints = questions.reduce((acc, q) => acc + (Number(q.points) || 0), 0);

  function patchQuestion(idx: number, patch: Partial<Question>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  }

  function addQuestion(type: QuestionType) {
    setQuestions((prev) => [...prev, { ...newQuestion(type), position: prev.length }]);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function onSave() {
    setError(null);
    setFieldErrors({});
    setSavedAt(null);
    startTransition(async () => {
      const result = await saveExamAction({
        moduleId: initial.moduleId,
        title: title.trim(),
        passingScore: Number(passingScore),
        durationMinutes: Number(durationMinutes),
        questions: questions.map((q, i) => ({ ...q, position: i })),
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setSavedAt(new Date());
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Exam settings */}
      <section className="hz-card p-5 space-y-4">
        <div
          className="text-xs hz-mono uppercase tracking-[.16em]"
          style={{ color: "var(--hz-ink-3)" }}
        >
          Settings
        </div>
        <Field
          label="Title"
          htmlFor="exam-title"
          error={fieldErrors.title}
        >
          <Input
            id="exam-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Passing score (%)"
            htmlFor="exam-pass"
            error={fieldErrors.passingScore}
          >
            <Input
              id="exam-pass"
              type="number"
              min={0}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Duration (minutes)"
            htmlFor="exam-duration"
            error={fieldErrors.durationMinutes}
          >
            <Input
              id="exam-duration"
              type="number"
              min={1}
              max={360}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              required
            />
          </Field>
        </div>
        <p
          className="hz-mono text-xs"
          style={{ color: "var(--hz-ink-3)" }}
        >
          Total points across all questions: <span style={{ color: "var(--hz-ink-2)" }}>{totalPoints}</span> · students need {Math.ceil((totalPoints * Number(passingScore || 0)) / 100)} to pass.
        </p>
      </section>

      {/* Questions */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="section-title">
            Questions · {questions.length}
          </h2>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => addQuestion("MC")}>
              + Multiple choice
            </Button>
            <Button type="button" variant="outline" onClick={() => addQuestion("FILL")}>
              + Fill in blank
            </Button>
            <Button type="button" variant="outline" onClick={() => addQuestion("OPEN")}>
              + Open response
            </Button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-8 text-center hz-mono text-sm"
            style={{ color: "var(--hz-ink-3)", borderColor: "var(--hz-line)" }}
          >
            No questions yet. Add one above.
          </div>
        ) : (
          <ol className="space-y-3">
            {questions.map((q, idx) => (
              <li
                key={q.id ?? `new-${idx}`}
                className="hz-card p-4 space-y-3"
              >
                <header className="flex items-center gap-3">
                  <span
                    className="hz-mono text-xs"
                    style={{
                      color: "var(--hz-ink-3)",
                      width: 28,
                      textAlign: "right",
                    }}
                  >
                    {idx + 1}.
                  </span>
                  <span className="chip chip-outline">{TYPE_LABEL[q.type]}</span>
                  <div className="flex-1" />
                  <span
                    className="hz-mono text-xs"
                    style={{ color: "var(--hz-ink-3)" }}
                  >
                    {q.points} pt{q.points === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveQuestion(idx, -1)}
                    disabled={idx === 0}
                    className="ibtn"
                    title="Move up"
                    aria-label="Move up"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(idx, 1)}
                    disabled={idx === questions.length - 1}
                    className="ibtn"
                    title="Move down"
                    aria-label="Move down"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="ibtn"
                    style={{ color: "var(--hz-danger)" }}
                    title="Remove question"
                    aria-label="Remove question"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </header>

                <div className="grid grid-cols-[1fr_120px] gap-3">
                  <Field
                    label="Prompt"
                    htmlFor={`q-${idx}-prompt`}
                    error={fieldErrors[`questions.${idx}.prompt`]}
                  >
                    <Textarea
                      id={`q-${idx}-prompt`}
                      rows={2}
                      value={q.prompt}
                      onChange={(e) => patchQuestion(idx, { prompt: e.target.value })}
                      placeholder="Write the question…"
                    />
                  </Field>
                  <Field
                    label="Points"
                    htmlFor={`q-${idx}-points`}
                    error={fieldErrors[`questions.${idx}.points`]}
                  >
                    <Input
                      id={`q-${idx}-points`}
                      type="number"
                      min={1}
                      max={100}
                      value={q.points}
                      onChange={(e) =>
                        patchQuestion(idx, {
                          points: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </Field>
                </div>

                {q.type === "MC" ? (
                  <McEditor
                    choices={q.choices}
                    correctIndex={q.correctIndex}
                    onChange={(choices, correctIndex) =>
                      patchQuestion(idx, { choices, correctIndex })
                    }
                  />
                ) : null}

                {q.type === "FILL" ? (
                  <FillEditor
                    answers={q.acceptedAnswers}
                    onChange={(acceptedAnswers) =>
                      patchQuestion(idx, { acceptedAnswers })
                    }
                  />
                ) : null}

                {q.type === "OPEN" ? (
                  <p
                    className="hz-mono text-xs"
                    style={{ color: "var(--hz-ink-3)" }}
                  >
                    Open response — teacher grades during the post-exam
                    review.
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 sticky bottom-0 py-3 hair-t" style={{ background: "var(--hz-bg)" }}>
        {savedAt ? (
          <span className="hz-mono text-xs" style={{ color: "var(--hz-success)" }}>
            Saved {savedAt.toLocaleTimeString()}
          </span>
        ) : null}
        <Button type="button" onClick={onSave} disabled={pending}>
          {pending ? "Saving…" : "Save exam"}
        </Button>
      </div>
    </div>
  );
}

function McEditor({
  choices,
  correctIndex,
  onChange,
}: {
  choices: string[];
  correctIndex: number | null;
  onChange: (choices: string[], correctIndex: number | null) => void;
}) {
  function patchChoice(idx: number, value: string) {
    const next = choices.map((c, i) => (i === idx ? value : c));
    onChange(next, correctIndex);
  }
  function addChoice() {
    onChange([...choices, ""], correctIndex);
  }
  function removeChoice(idx: number) {
    const next = choices.filter((_, i) => i !== idx);
    // Re-clamp correctIndex when its choice is removed.
    let nextCorrect: number | null = correctIndex;
    if (correctIndex === idx) nextCorrect = null;
    else if (correctIndex !== null && correctIndex > idx) nextCorrect = correctIndex - 1;
    onChange(next, nextCorrect);
  }
  return (
    <div className="space-y-2">
      <div
        className="hz-mono text-xs uppercase tracking-[.14em]"
        style={{ color: "var(--hz-ink-3)" }}
      >
        Choices · pick the correct one
      </div>
      <ol className="space-y-1.5">
        {choices.map((c, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <input
              type="radio"
              checked={correctIndex === idx}
              onChange={() => onChange(choices, idx)}
              aria-label={`Correct answer: choice ${idx + 1}`}
              className="hz-cb"
            />
            <Input
              value={c}
              onChange={(e) => patchChoice(idx, e.target.value)}
              placeholder={`Choice ${idx + 1}`}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeChoice(idx)}
              disabled={choices.length <= 2}
              className="ibtn"
              title="Remove choice"
              aria-label="Remove choice"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={addChoice}
        className="btn-ghost text-xs"
      >
        + Add choice
      </button>
    </div>
  );
}

function FillEditor({
  answers,
  onChange,
}: {
  answers: string[];
  onChange: (next: string[]) => void;
}) {
  function patchAnswer(idx: number, value: string) {
    onChange(answers.map((a, i) => (i === idx ? value : a)));
  }
  function addAnswer() {
    onChange([...answers, ""]);
  }
  function removeAnswer(idx: number) {
    if (answers.length <= 1) return;
    onChange(answers.filter((_, i) => i !== idx));
  }
  return (
    <div className="space-y-2">
      <div
        className="hz-mono text-xs uppercase tracking-[.14em]"
        style={{ color: "var(--hz-ink-3)" }}
      >
        Accepted answers · matched case-insensitive after trim
      </div>
      <ol className="space-y-1.5">
        {answers.map((a, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <Input
              value={a}
              onChange={(e) => patchAnswer(idx, e.target.value)}
              placeholder={`Answer ${idx + 1}`}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeAnswer(idx)}
              disabled={answers.length <= 1}
              className="ibtn"
              title="Remove answer"
              aria-label="Remove answer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={addAnswer}
        className="btn-ghost text-xs"
      >
        + Add accepted answer
      </button>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
