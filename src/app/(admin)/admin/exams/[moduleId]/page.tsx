import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrCreateExamForModule } from "@/lib/actions/exams";
import { ExamEditor } from "./exam-editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit exam · Horizonte CRM" };

export default async function ExamEditorPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  const exam = await getOrCreateExamForModule(moduleId);
  if (!exam) notFound();

  return (
    <div className="space-y-5">
      <section className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div
            className="text-xs hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Assessment · M{exam.module.number}
          </div>
          <h1 className="font-display text-3xl font-medium mt-1">
            {exam.module.name}
          </h1>
          <p
            className="mt-1.5 text-sm hz-mono"
            style={{ color: "var(--hz-ink-2)" }}
          >
            {exam.questions.length}{" "}
            {exam.questions.length === 1 ? "question" : "questions"} ·{" "}
            {exam.passingScore}% to pass · {exam.durationMinutes}m duration
          </p>
        </div>
        <Link href="/admin/exams" className="btn-ghost">
          Back to exams
        </Link>
      </section>

      <ExamEditor
        initial={{
          moduleId: exam.module.id,
          title: exam.title,
          passingScore: exam.passingScore,
          durationMinutes: exam.durationMinutes,
          questions: exam.questions.map((q) => ({
            id: q.id,
            position: q.position,
            type: q.type,
            prompt: q.prompt,
            points: q.points,
            choices: (q.choices as string[]) ?? [],
            correctIndex: q.correctIndex,
            acceptedAnswers: (q.acceptedAnswers as string[]) ?? [],
          })),
        }}
      />
    </div>
  );
}
