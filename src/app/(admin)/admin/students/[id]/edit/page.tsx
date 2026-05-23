import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EditStudentForm } from "./edit-student-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit student · Horizonte CRM" };

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [student, batches] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: {
        enrollments: {
          orderBy: { enrolledAt: "desc" },
          take: 1,
          select: { batchId: true, batch: { select: { code: true } } },
        },
      },
    }),
    prisma.batch.findMany({
      where: { status: { in: ["UPCOMING", "ACTIVE"] } },
      orderBy: { startDate: "desc" },
      select: { id: true, code: true, startDate: true, status: true },
    }),
  ]);
  if (!student) notFound();
  const currentBatch = student.enrollments[0] ?? null;

  return (
    <div className="space-y-5 max-w-3xl">
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div
            className="text-sm hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Edit student
          </div>
          <h1 className="font-display text-3xl font-medium mt-1">
            {student.fullName}
          </h1>
          <p className="mt-1 hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
            Changes are audit-logged.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href={`/admin/students/${id}`} className="btn-ghost">
          Back
        </a>
      </section>

      <EditStudentForm
        initial={{
          id: student.id,
          fullName: student.fullName,
          email: student.email,
          phone: student.phone,
          docType: student.docType,
          docNumber: student.docNumber,
          dob: student.dob.toISOString().slice(0, 10),
          docExpiry: student.docExpiry.toISOString().slice(0, 10),
          nationality: student.nationality,
          nif: student.nif,
          niss: student.niss ?? "",
          address: student.address,
          city: student.city,
          notes: student.notes ?? "",
          batchId: currentBatch?.batchId ?? "",
        }}
        batches={batches.map((b) => ({
          id: b.id,
          label: `${b.code} · starts ${b.startDate.toISOString().slice(0, 10)} · ${b.status.toLowerCase()}`,
        }))}
        currentBatchCode={currentBatch?.batch.code ?? null}
      />
    </div>
  );
}
