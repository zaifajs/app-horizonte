import Link from "next/link";
import { prisma } from "@/lib/db";
import { NewBatchForm } from "./new-batch-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New batch · Horizonte CRM",
};

export default async function NewBatchPage() {
  const [courses, trainers] = await Promise.all([
    prisma.course.findMany({
      orderBy: { code: "asc" },
      include: {
        modules: { select: { id: true, classroomDays: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "TEACHER", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-5 max-w-2xl">
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div
            className="text-sm hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Cronograma
          </div>
          <h1 className="font-display text-3xl font-medium mt-1">New batch</h1>
          <p className="mt-1 hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
            Generates the full schedule from the selected course.
            {courses.length === 1
              ? ` Currently only ${courses[0].code} is offered.`
              : ""}
          </p>
        </div>
        <Link href="/admin/batches" className="btn-ghost">
          Cancel
        </Link>
      </section>

      <div className="hz-card p-5">
        <NewBatchForm
          courses={courses.map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            moduleCount: c.modules.length,
            classroomDays: c.modules[0]?.classroomDays ?? 5,
          }))}
          trainers={trainers}
        />
      </div>
    </div>
  );
}
