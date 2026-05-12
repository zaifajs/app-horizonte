import Link from "next/link";
import { notFound } from "next/navigation";
import { format, isSameDay, startOfToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TeacherBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["TEACHER"]);
  const { id } = await params;

  const batch = await prisma.batch.findFirst({
    where: { id, trainerId: user.id },
    include: {
      course: true,
      sessions: {
        orderBy: [{ scheduledDate: "asc" }, { kind: "asc" }],
        include: {
          module: { select: { number: true, name: true } },
          _count: { select: { attendances: true } },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!batch) notFound();

  const today = startOfToday();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Batch {batch.code}
          </h1>
          <p className="text-sm text-muted-foreground">
            {batch.course.code} · {batch.course.name} · {batch._count.enrollments} enrolled
          </p>
        </div>
        <Link href="/teacher">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <ul className="space-y-1">
        {batch.sessions.map((s) => {
          const isCurrent = isSameDay(s.scheduledDate, today);
          const isAutonomous = s.kind === "AUTONOMOUS";
          return (
            <li
              key={s.id}
              className={`rounded-lg border p-3 ${
                isCurrent ? "border-zinc-900 bg-zinc-50" : "bg-white"
              }`}
            >
              <Link
                href={`/teacher/sessions/${s.id}`}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    M{s.module.number} · {s.module.name}
                  </div>
                  <div className="font-medium">
                    {isAutonomous ? (
                      <span className="italic text-muted-foreground">
                        Homework block
                      </span>
                    ) : (
                      <>
                        {format(s.scheduledDate, "EEE dd MMM yyyy")} ·{" "}
                        {s.startTime}–{s.endTime}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <SessionStatusBadge status={s.status} />
                  {s.status === "HELD" ? (
                    <span className="text-xs text-muted-foreground">
                      {s._count.attendances} marked
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SCHEDULED: { label: "Scheduled", cls: "text-muted-foreground" },
    HELD: { label: "Held", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    CANCELLED: { label: "Cancelled", cls: "bg-red-50 border-red-200 text-red-700" },
    RESCHEDULED: { label: "Rescheduled", cls: "bg-blue-50 border-blue-200 text-blue-700" },
  };
  const m = map[status] ?? map.SCHEDULED;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}
