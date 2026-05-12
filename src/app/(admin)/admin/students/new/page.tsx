import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { NewStudentForm } from "./new-student-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Add student · Horizonte CRM" };

export default async function NewStudentPage() {
  const batches = await prisma.batch.findMany({
    where: { status: "UPCOMING" },
    orderBy: { startDate: "asc" },
    select: { id: true, code: true, startDate: true },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add student</h1>
          <p className="text-sm text-muted-foreground">
            Manual entry. Public registration is at <code>/en/register</code>.
          </p>
        </div>
        <Link href="/admin/students">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <NewStudentForm
        batches={batches.map((b) => ({
          id: b.id,
          label: `${b.code} — starts ${b.startDate.toISOString().slice(0, 10)}`,
        }))}
      />
    </div>
  );
}
