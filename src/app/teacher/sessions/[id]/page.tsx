import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { AttendanceForm } from "./attendance-form";

export const dynamic = "force-dynamic";

export default async function TeacherSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["TEACHER", "ADMIN", "STAFF"]);
  const { id } = await params;

  const session = await prisma.batchSession.findUnique({
    where: { id },
    include: {
      module: true,
      batch: {
        select: {
          id: true,
          code: true,
          trainerId: true,
          enrollments: {
            where: { status: { in: ["PENDING", "ACTIVE"] } },
            include: { student: { select: { id: true, fullName: true } } },
            orderBy: { enrolledAt: "asc" },
          },
        },
      },
      attendances: true,
    },
  });
  if (!session) notFound();
  if (user.role === "TEACHER" && session.batch.trainerId !== user.id) {
    notFound();
  }

  if (session.kind === "AUTONOMOUS") {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="text-sm hz-mono uppercase tracking-[.18em]" style={{ color: "var(--hz-ink-3)" }}>
          Batch {session.batch.code} · Autonomous
        </div>
        <h1 className="font-display text-3xl font-medium">Homework block</h1>
        <p className="hz-mono text-sm" style={{ color: "var(--hz-ink-2)" }}>
          Module {session.module.number} · {session.module.name}
          <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>·</span>
          {session.hours}h autonomous work
        </p>
        <Link href={`/teacher/batches/${session.batch.id}`} className="btn-ghost">
          Back to batch
        </Link>
      </div>
    );
  }

  // Build a lookup of existing attendance entries.
  const existing = new Map(
    session.attendances.map((a) => [
      a.enrollmentId,
      { state: a.state, notes: a.notes },
    ]),
  );
  const roster = session.batch.enrollments.map((e) => ({
    enrollmentId: e.id,
    studentName: e.student.fullName,
    state: existing.get(e.id)?.state ?? null,
    notes: existing.get(e.id)?.notes ?? "",
  }));

  const statusTone =
    session.status === "HELD"
      ? "var(--hz-success)"
      : session.status === "CANCELLED"
        ? "var(--hz-danger)"
        : session.status === "RESCHEDULED"
          ? "var(--hz-info)"
          : "var(--hz-warning)";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div
            className="text-sm hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Mark attendance
          </div>
          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            <h1 className="font-display text-3xl font-medium">
              {format(session.scheduledDate, "EEE dd MMM yyyy")}
            </h1>
            <span className="status-pill" style={{ color: statusTone }}>
              <span className="dot" style={{ background: statusTone }} />
              {session.status.toLowerCase()}
            </span>
          </div>
          <p className="mt-1 hz-mono text-sm" style={{ color: "var(--hz-ink-2)" }}>
            Batch <span style={{ color: "var(--hz-primary)" }}>{session.batch.code}</span>
            <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>·</span>
            M{session.module.number} · {session.module.name}
            {session.startTime ? (
              <>
                <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>·</span>
                {session.startTime}–{session.endTime}
              </>
            ) : null}
          </p>
        </div>
        <Link href={`/teacher/batches/${session.batch.id}`} className="btn-ghost">
          Back to batch
        </Link>
      </div>

      {roster.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-8 text-center hz-mono text-sm"
          style={{ color: "var(--hz-ink-3)", borderColor: "var(--hz-line)" }}
        >
          No enrolled students in this batch yet.
        </div>
      ) : (
        <AttendanceForm
          sessionId={session.id}
          batchId={session.batch.id}
          notes={session.notes ?? ""}
          rows={roster}
        />
      )}
    </div>
  );
}
