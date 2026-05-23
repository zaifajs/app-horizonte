import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { GradingForm } from "./grading-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Grade exam · Horizonte CRM" };

// Teacher (or admin) grading queue for a scheduled EXAM session. Lists every
// student submission with its auto-graded score and the OPEN questions
// awaiting teacher points. Submissions in IN_PROGRESS state are listed but
// not gradable yet — they show up with a chip so the teacher can see who
// hasn't finished.

export default async function GradeExamPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireRole(["ADMIN", "STAFF", "TEACHER"]);
  const { sessionId } = await params;

  const session = await prisma.batchSession.findUnique({
    where: { id: sessionId },
    include: {
      batch: {
        select: {
          id: true,
          code: true,
          trainerId: true,
          course: { select: { code: true, level: true } },
        },
      },
      module: { select: { id: true, number: true, name: true } },
      exam: {
        include: {
          questions: { orderBy: { position: "asc" } },
        },
      },
      submissions: {
        orderBy: { submittedAt: "asc" },
        include: {
          student: { select: { id: true, fullName: true, email: true } },
          answers: true,
        },
      },
    },
  });
  if (!session || session.kind !== "EXAM" || !session.exam) notFound();
  // Teachers can only grade their own batch's exams.
  if (user.role === "TEACHER" && session.batch.trainerId !== user.id) {
    notFound();
  }

  const totalPoints = session.exam.questions.reduce(
    (acc, q) => acc + q.points,
    0,
  );

  return (
    <div className="space-y-5">
      <section className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div
            className="text-xs hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Grading · M{session.module.number} · Batch {session.batch.code}
          </div>
          <h1 className="font-display text-3xl font-medium mt-1">
            {session.exam.title}
          </h1>
          <p
            className="mt-1.5 text-sm hz-mono"
            style={{ color: "var(--hz-ink-2)" }}
          >
            {session.batch.course.code} · {session.batch.course.level}
            <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>·</span>
            {format(session.scheduledDate, "EEE dd MMM yyyy")}
            {session.startTime ? ` · ${session.startTime}` : ""}
            <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>·</span>
            {session.submissions.length} submission
            {session.submissions.length === 1 ? "" : "s"} ·{" "}
            {totalPoints} points possible
          </p>
        </div>
        <Link href={`/teacher/batches/${session.batch.id}`} className="btn-ghost">
          Back to batch
        </Link>
      </section>

      {session.submissions.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-10 text-center hz-mono text-sm"
          style={{ color: "var(--hz-ink-3)", borderColor: "var(--hz-line)" }}
        >
          No submissions yet. Students take this exam from their portal once
          the session is live.
        </div>
      ) : (
        <GradingForm
          questions={session.exam.questions.map((q) => ({
            id: q.id,
            position: q.position,
            type: q.type,
            prompt: q.prompt,
            points: q.points,
            choices: (q.choices as string[]) ?? [],
            correctIndex: q.correctIndex,
            acceptedAnswers: (q.acceptedAnswers as string[]) ?? [],
          }))}
          submissions={session.submissions.map((s) => ({
            id: s.id,
            studentName: s.student.fullName,
            studentEmail: s.student.email,
            status: s.status,
            startedAt: s.startedAt.toISOString(),
            submittedAt: s.submittedAt?.toISOString() ?? null,
            autoScore: s.autoScore,
            teacherScore: s.teacherScore,
            answers: s.answers.map((a) => ({
              id: a.id,
              questionId: a.questionId,
              answerIndex: a.answerIndex,
              answerText: a.answerText,
              pointsAwarded: a.pointsAwarded,
            })),
          }))}
          totalPoints={totalPoints}
          passingScore={session.exam.passingScore}
        />
      )}
    </div>
  );
}
