import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { loadStudentContext } from "@/lib/student/me";

export const dynamic = "force-dynamic";

export const metadata = { title: "Exam result · Horizonte CRM" };

// Post-submit summary. Shows the auto-graded portion immediately + a "pending
// teacher review" notice if there are OPEN answers awaiting grading. Once
// the teacher grades and flips the submission to GRADED, this page renders
// the final pass/fail decision.

export default async function ExamResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { student } = await loadStudentContext();
  if (!student) notFound();

  const session = await prisma.batchSession.findUnique({
    where: { id: sessionId },
    include: {
      module: { select: { number: true, name: true } },
      exam: {
        select: {
          id: true,
          title: true,
          passingScore: true,
          questions: {
            orderBy: { position: "asc" },
            select: { id: true, type: true, prompt: true, points: true },
          },
        },
      },
    },
  });
  if (!session || session.kind !== "EXAM" || !session.exam) notFound();

  const submission = await prisma.examSubmission.findUnique({
    where: {
      studentId_batchSessionId: {
        studentId: student.id,
        batchSessionId: session.id,
      },
    },
    include: { answers: true },
  });
  if (!submission) notFound();

  const totalPoints = session.exam.questions.reduce((a, q) => a + q.points, 0);
  const openPointsPossible = session.exam.questions
    .filter((q) => q.type === "OPEN")
    .reduce((a, q) => a + q.points, 0);
  const auto = submission.autoScore ?? 0;
  const teacher = submission.teacherScore ?? 0;
  const finalScore = teacher + auto;
  const isGraded = submission.status === "GRADED";
  const passThreshold = Math.ceil((totalPoints * session.exam.passingScore) / 100);
  const finalPasses = finalScore >= passThreshold;
  const autoOnlyPasses = auto >= passThreshold; // before any OPEN scoring
  const hasOpen = openPointsPossible > 0;

  return (
    <div className="space-y-5 max-w-3xl">
      <header>
        <div
          className="hz-mono text-xs uppercase tracking-[.18em]"
          style={{ color: "var(--hz-ink-3)" }}
        >
          Exam · M{session.module.number} · {session.module.name}
        </div>
        <h1 className="font-display text-2xl font-medium mt-1">
          {session.exam.title}
        </h1>
        <p
          className="hz-mono text-xs mt-1"
          style={{ color: "var(--hz-ink-3)" }}
        >
          Submitted{" "}
          {submission.submittedAt
            ? format(submission.submittedAt, "dd MMM yyyy 'at' HH:mm")
            : "—"}
        </p>
      </header>

      {/* Hero score card */}
      <section
        className="hz-card p-5"
        style={{
          borderColor: isGraded
            ? finalPasses
              ? "var(--hz-success)"
              : "var(--hz-warning)"
            : "var(--hz-line)",
        }}
      >
        <div
          className="hz-mono text-xs uppercase tracking-[.16em]"
          style={{
            color: isGraded
              ? finalPasses
                ? "var(--hz-success)"
                : "var(--hz-warning)"
              : "var(--hz-ink-3)",
          }}
        >
          {isGraded
            ? finalPasses
              ? "Passed"
              : "Did not pass"
            : "Auto-graded score"}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span
            className="stat-num tabular-nums"
            style={{
              color: isGraded
                ? finalPasses
                  ? "var(--hz-success)"
                  : "var(--hz-warning)"
                : "var(--hz-ink)",
              fontFamily: "var(--font-display)",
              fontSize: "3rem",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {finalScore}
          </span>
          <span
            className="hz-mono text-lg"
            style={{ color: "var(--hz-ink-3)" }}
          >
            / {totalPoints}
          </span>
        </div>
        <div className="pbar mt-3">
          <span
            style={{
              width: `${Math.round((finalScore / totalPoints) * 100)}%`,
              background: isGraded
                ? finalPasses
                  ? "var(--hz-success)"
                  : "var(--hz-warning)"
                : "var(--hz-primary)",
            }}
          />
        </div>
        <p
          className="mt-3 hz-mono text-xs"
          style={{ color: "var(--hz-ink-3)" }}
        >
          {session.exam.passingScore}% to pass ({passThreshold}+ points)
          {!isGraded && hasOpen ? (
            <>
              {" "}· {openPointsPossible} point
              {openPointsPossible === 1 ? "" : "s"} of open-response answers
              pending teacher review
            </>
          ) : null}
        </p>
      </section>

      {!isGraded && hasOpen ? (
        <div
          className="rounded-md px-4 py-3 text-sm"
          style={{
            background: "color-mix(in oklab, var(--hz-info) 8%, transparent)",
            border: "1px solid color-mix(in oklab, var(--hz-info) 35%, var(--hz-line))",
            color: "var(--hz-ink)",
          }}
        >
          {autoOnlyPasses
            ? "You've already passed on the auto-graded portion. The teacher review may add additional points."
            : `You need ${passThreshold - auto}+ more from the teacher-graded responses to pass.`}
        </div>
      ) : null}

      <div>
        <Link href="/student" className="btn-ghost text-sm">
          Back to home
        </Link>
      </div>
    </div>
  );
}
