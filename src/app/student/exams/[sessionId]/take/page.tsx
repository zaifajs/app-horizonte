import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { startOfToday } from "date-fns";
import { prisma } from "@/lib/db";
import { loadStudentContext } from "@/lib/student/me";
import { TakeExamForm } from "./take-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Exam · Horizonte CRM" };

// Student exam-take page. Gated by:
//   1. STUDENT role + linked Student record (via loadStudentContext)
//   2. The student's current enrollment matches the session's batch
//   3. The session is kind=EXAM with an attached Exam definition
//   4. The session is scheduled for today or in the past (honour system —
//      students can't take the exam before it's open)
//   5. The student hasn't already SUBMITTED — if they have, redirect to
//      the result page

export default async function TakeExamPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { student, currentEnrollment } = await loadStudentContext();
  if (!student || !currentEnrollment) notFound();

  const session = await prisma.batchSession.findUnique({
    where: { id: sessionId },
    include: {
      module: { select: { number: true, name: true } },
      batch: { select: { id: true, code: true } },
      exam: {
        include: {
          questions: { orderBy: { position: "asc" } },
        },
      },
    },
  });
  if (!session || session.kind !== "EXAM" || !session.exam) notFound();
  // Must be your batch.
  if (session.batchId !== currentEnrollment.batchId) notFound();

  // Window check: scheduledDate must be today or earlier (UTC compare on the
  // date portion). Future-dated exams aren't available yet.
  const today = startOfToday();
  if (session.scheduledDate.getTime() > today.getTime()) {
    return (
      <div className="hz-card p-6 space-y-3">
        <h1 className="font-display text-xl font-medium">Not open yet</h1>
        <p className="text-sm" style={{ color: "var(--hz-ink-2)" }}>
          This exam opens on{" "}
          {session.scheduledDate.toISOString().slice(0, 10)}
          {session.startTime ? ` at ${session.startTime}` : ""}. Come back
          then.
        </p>
        <Link href="/student/schedule" className="btn-ghost text-sm">
          Back to schedule
        </Link>
      </div>
    );
  }

  // If a submission already exists in SUBMITTED or GRADED, redirect to result.
  const existing = await prisma.examSubmission.findUnique({
    where: {
      studentId_batchSessionId: {
        studentId: student.id,
        batchSessionId: session.id,
      },
    },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== "IN_PROGRESS") {
    redirect(`/student/exams/${session.id}/result`);
  }

  const totalPoints = session.exam.questions.reduce(
    (acc, q) => acc + q.points,
    0,
  );

  return (
    <TakeExamForm
      sessionId={session.id}
      title={session.exam.title}
      moduleNumber={session.module.number}
      moduleName={session.module.name}
      durationMinutes={session.exam.durationMinutes}
      totalPoints={totalPoints}
      questions={session.exam.questions.map((q) => ({
        id: q.id,
        position: q.position,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        choices: (q.choices as string[]) ?? [],
      }))}
    />
  );
}
