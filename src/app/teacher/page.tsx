import Link from "next/link";
import { format, isToday, isSameDay, startOfToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Teacher · Horizonte CRM" };

export default async function TeacherHome() {
  const user = await requireRole(["TEACHER"]);
  const today = startOfToday();

  const batches = await prisma.batch.findMany({
    where: { trainerId: user.id, status: { in: ["UPCOMING", "ACTIVE", "FINISHED"] } },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    include: {
      course: { select: { code: true, name: true } },
      sessions: {
        where: { kind: "CLASSROOM" },
        orderBy: { scheduledDate: "asc" },
        select: { id: true, scheduledDate: true, startTime: true, endTime: true, status: true },
      },
      _count: { select: { enrollments: true } },
    },
  });

  // Find today's sessions across all assigned batches.
  const todaysSessions: Array<{
    batchCode: string;
    batchId: string;
    sessionId: string;
    startTime: string | null;
    endTime: string | null;
    enrolledCount: number;
  }> = [];
  for (const b of batches) {
    for (const s of b.sessions) {
      if (isToday(s.scheduledDate) || isSameDay(s.scheduledDate, today)) {
        todaysSessions.push({
          batchCode: b.code,
          batchId: b.id,
          sessionId: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          enrolledCount: b._count.enrollments,
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-zinc-50 to-white p-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi, {user.name.split(" ")[0]}.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {batches.length} batch{batches.length === 1 ? "" : "es"} assigned.
        </p>
      </div>

      {todaysSessions.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Today
          </h2>
          {todaysSessions.map((s) => (
            <Link
              key={s.sessionId}
              href={`/teacher/sessions/${s.sessionId}`}
              className="block rounded-xl border bg-zinc-900 text-white p-4 hover:bg-zinc-800 transition-colors"
            >
              <div className="text-xs uppercase tracking-wide opacity-80">
                Now · Batch {s.batchCode}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-lg font-semibold">
                  {s.startTime}–{s.endTime}
                </div>
                <div className="text-sm opacity-80">
                  {s.enrolledCount} enrolled
                </div>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          My batches
        </h2>
        {batches.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No batches assigned yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {batches.map((b) => {
              const firstClassroom = b.sessions[0]?.scheduledDate;
              const lastClassroom = b.sessions[b.sessions.length - 1]?.scheduledDate;
              return (
                <li
                  key={b.id}
                  className="rounded-xl border bg-white p-4 hover:border-foreground/30 transition-colors"
                >
                  <Link href={`/teacher/batches/${b.id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Batch {b.code}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {b.status.toLowerCase()}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {b.course.code} · {b.course.name}
                          {firstClassroom && lastClassroom
                            ? ` · ${format(firstClassroom, "dd MMM")} – ${format(lastClassroom, "dd MMM yyyy")}`
                            : ""}
                          {" · "}{b._count.enrollments} enrolled
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Open
                      </Button>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
