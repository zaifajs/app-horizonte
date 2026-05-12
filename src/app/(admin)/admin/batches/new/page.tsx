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
      select: { id: true, code: true, name: true },
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
            Generates the full cronograma — 6 modules × 5 classroom days + 6
            autonomous blocks (36 sessions total).
          </p>
        </div>
        <Link href="/admin/batches">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <NewBatchForm courses={courses} trainers={trainers} />
    </div>
  );
}
