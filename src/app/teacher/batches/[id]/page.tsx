import Link from "next/link";
import { notFound } from "next/navigation";
import { format, isSameDay, startOfToday } from "date-fns";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, { color: string; label: string }> = {
  SCHEDULED: { color: "var(--hz-ink-3)", label: "Scheduled" },
  HELD: { color: "var(--hz-success)", label: "Held" },
  CANCELLED: { color: "var(--hz-danger)", label: "Cancelled" },
  RESCHEDULED: { color: "var(--hz-info)", label: "Rescheduled" },
};

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
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div
            className="text-sm hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            My batch
          </div>
          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            <h1 className="font-display text-3xl font-medium">
              Batch <span style={{ color: "var(--hz-primary)" }}>{batch.code}</span>
            </h1>
            <span className="chip chip-outline">
              {batch.course.code} · {batch.course.level}
            </span>
          </div>
          <p className="mt-1 hz-mono text-sm" style={{ color: "var(--hz-ink-2)" }}>
            {batch.course.name}
            <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>·</span>
            {batch._count.enrollments} enrolled
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/teacher/batches/${batch.id}/attendance`} className="btn-ghost">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 10h18" />
            </svg>
            Attendance
          </Link>
          <Link href="/teacher" className="btn-ghost">
            Back
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {batch.sessions.map((s) => {
          const isCurrent = isSameDay(s.scheduledDate, today);
          const isAutonomous = s.kind === "AUTONOMOUS";
          const tone = STATUS_TONE[s.status] ?? STATUS_TONE.SCHEDULED;
          return (
            <Link
              key={s.id}
              href={`/teacher/sessions/${s.id}`}
              className="hz-card p-3 transition"
              style={
                isCurrent
                  ? { borderColor: "var(--hz-primary)", background: "var(--hz-primary-50)" }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="hz-mono text-xs font-semibold"
                  style={{
                    color: isCurrent ? "var(--hz-primary)" : "var(--hz-ink-3)",
                    letterSpacing: "0.16em",
                  }}
                >
                  M{s.module.number}
                </span>
                <span className="status-pill" style={{ color: tone.color }}>
                  <span className="dot" style={{ background: tone.color }} />
                  {tone.label}
                </span>
              </div>
              <div className="mt-2 text-sm font-medium leading-snug truncate">
                {s.module.name}
              </div>
              <div className="mt-1.5">
                {isAutonomous ? (
                  <span
                    className="italic hz-mono text-sm"
                    style={{ color: "var(--hz-ink-3)" }}
                  >
                    Homework block
                  </span>
                ) : (
                  <>
                    <div className="hz-mono text-sm">
                      {format(s.scheduledDate, "EEE dd MMM yyyy")}
                    </div>
                    <div className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
                      {s.startTime}–{s.endTime}
                    </div>
                  </>
                )}
              </div>
              {s.status === "HELD" ? (
                <div className="mt-2 hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
                  {s._count.attendances} marked
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
