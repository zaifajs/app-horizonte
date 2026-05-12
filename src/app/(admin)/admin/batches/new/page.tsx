import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New batch</h1>
          <p className="text-sm text-muted-foreground">
            Generates the full cronograma from the selected course.
            {courses.length === 1
              ? ` (Currently only ${courses[0].code} is offered.)`
              : ""}
          </p>
        </div>
        <Link href="/admin/batches">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

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
  );
}
