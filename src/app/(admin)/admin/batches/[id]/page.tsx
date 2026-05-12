import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      course: true,
      trainer: { select: { name: true } },
      sessions: { orderBy: [{ scheduledDate: "asc" }, { kind: "asc" }] },
      _count: { select: { enrollments: true } },
    },
  });
  if (!batch) notFound();

  const classroom = batch.sessions.filter((s) => s.kind === "CLASSROOM");
  const autonomous = batch.sessions.filter((s) => s.kind === "AUTONOMOUS");
  const lastDate = classroom[classroom.length - 1]?.scheduledDate;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Batch {batch.code}
            </h1>
            <Badge variant="outline">{batch.status.toLowerCase()}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {batch.course.code} — {batch.course.name}
          </p>
        </div>
        <Link href="/admin/batches">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Starts" value={format(batch.startDate, "dd MMM yyyy")} />
        <Stat label="Ends (est.)" value={lastDate ? format(lastDate, "dd MMM yyyy") : "—"} />
        <Stat label="Time" value={`${batch.startTime}–${addHours(batch.startTime, batch.durationHours)}`} />
        <Stat label="Trainer" value={batch.trainer?.name ?? "Unassigned"} />
        <Stat label="Capacity" value={String(batch.capacity)} />
        <Stat label="Enrolled" value={String(batch._count.enrollments)} />
        <Stat label="Classroom sessions" value={String(classroom.length)} />
        <Stat label="Autonomous blocks" value={String(autonomous.length)} />
      </div>

      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Cronograma journey view — built in Task 2.3. For now, sessions exist in
        the DB: {classroom.length} classroom + {autonomous.length} autonomous.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h + hours).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
