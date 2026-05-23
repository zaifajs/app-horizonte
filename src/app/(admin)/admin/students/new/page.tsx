import Link from "next/link";
import { prisma } from "@/lib/db";
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
    <div className="space-y-5 max-w-3xl">
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div
            className="text-sm hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Enrollment
          </div>
          <h1 className="font-display text-3xl font-medium mt-1">Add student</h1>
          <p className="mt-1 hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
            Manual entry. Public registration form lives at /en/register.
          </p>
        </div>
        <Link href="/admin/students" className="btn-ghost">
          Cancel
        </Link>
      </section>

      <div className="hz-card p-5">
        <NewStudentForm
          batches={batches.map((b) => ({
            id: b.id,
            label: `${b.code} — starts ${b.startDate.toISOString().slice(0, 10)}`,
          }))}
        />
      </div>
    </div>
  );
}
