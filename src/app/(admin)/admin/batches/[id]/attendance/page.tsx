import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { AttendanceMatrix, parseLayout } from "@/components/attendance-matrix";

export const dynamic = "force-dynamic";

export default async function AdminBatchAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  const { id } = await params;
  const { layout: layoutRaw } = await searchParams;
  const layout = parseLayout(layoutRaw);

  const [batch, attendances] = await Promise.all([
    prisma.batch.findUnique({
      where: { id },
      include: {
        course: { select: { code: true, name: true } },
        sessions: {
          where: { kind: "CLASSROOM" },
          orderBy: { scheduledDate: "asc" },
          select: {
            id: true,
            scheduledDate: true,
            module: { select: { number: true } },
          },
        },
        enrollments: {
          where: { status: { in: ["PENDING", "ACTIVE"] } },
          orderBy: { student: { fullName: "asc" } },
          select: {
            id: true,
            student: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.attendance.findMany({
      where: { session: { batchId: id } },
      select: { sessionId: true, enrollmentId: true, state: true },
    }),
  ]);
  if (!batch) notFound();

  const cells = new Map(
    attendances.map((a) => [`${a.enrollmentId}|${a.sessionId}`, a.state]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Attendance · Batch {batch.code}
          </h1>
          <p className="text-sm text-muted-foreground">
            {batch.course.code} — {batch.course.name}
          </p>
        </div>
        <Link href={`/admin/batches/${batch.id}`}>
          <Button variant="outline">Back to batch</Button>
        </Link>
      </div>

      <AttendanceMatrix
        basePath={`/admin/batches/${batch.id}/attendance`}
        layout={layout}
        students={batch.enrollments.map((e) => ({
          enrollmentId: e.id,
          fullName: e.student.fullName,
        }))}
        sessions={batch.sessions.map((s) => ({
          id: s.id,
          scheduledDate: s.scheduledDate,
          moduleNumber: s.module.number,
        }))}
        cells={cells}
      />
    </div>
  );
}
