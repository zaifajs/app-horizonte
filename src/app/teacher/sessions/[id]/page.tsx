import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        <h1 className="text-xl font-semibold">Homework block</h1>
        <p className="text-sm text-muted-foreground">
          Module {session.module.number} · {session.module.name} ·{" "}
          {session.hours}h autonomous work
        </p>
        <Link href={`/teacher/batches/${session.batch.id}`}>
          <Button variant="outline">Back to batch</Button>
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {format(session.scheduledDate, "EEE dd MMM yyyy")}
            </h1>
            <Badge variant="outline">{session.status.toLowerCase()}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Batch {session.batch.code} · M{session.module.number} ·{" "}
            {session.module.name}
            {session.startTime ? ` · ${session.startTime}–${session.endTime}` : ""}
          </p>
        </div>
        <Link href={`/teacher/batches/${session.batch.id}`}>
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      {roster.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
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
