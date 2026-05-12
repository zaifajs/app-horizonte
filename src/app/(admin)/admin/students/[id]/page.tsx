import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { uploadedAt: "desc" } },
      enrollments: {
        include: {
          batch: { select: { code: true, startDate: true } },
          payments: { orderBy: { installment: "asc" } },
        },
        orderBy: { enrolledAt: "desc" },
      },
    },
  });
  if (!student) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {student.fullName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {student.email} · {student.phone} · {student.city}
          </p>
        </div>
        <Link href="/admin/students">
          <Button variant="outline">Back</Button>
        </Link>
      </header>

      <Section title="Personal">
        <Row label="Date of birth" value={format(student.dob, "dd MMM yyyy")} />
        <Row label="Nationality" value={student.nationality} />
        <Row label="Address" value={`${student.address}, ${student.city}`} />
        <Row label="NIF" value={student.nif} />
        <Row label="NISS" value={student.niss ?? "—"} />
        <Row label="Document" value={`${student.docType.replace("_", " ").toLowerCase()} · ${student.docNumber}`} />
        <Row label="Document expiry" value={format(student.docExpiry, "dd MMM yyyy")} />
        <Row label="GDPR consent" value={format(student.gdprConsentAt, "dd MMM yyyy 'at' HH:mm")} />
      </Section>

      <Section title="Documents">
        {student.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {student.documents.map((d) => (
              <li key={d.id}>
                {d.kind.replace(/_/g, " ").toLowerCase()} · uploaded{" "}
                {format(d.uploadedAt, "dd MMM yyyy")}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Enrolments">
        {student.enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enrolments yet.</p>
        ) : (
          <ul className="space-y-3">
            {student.enrollments.map((e) => (
              <li key={e.id} className="rounded-lg border bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    Batch {e.batch.code} · starts {format(e.batch.startDate, "dd MMM yyyy")}
                  </div>
                  <Badge variant="outline">{e.status.toLowerCase()}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {e.payments.map((p) => (
                    <div key={p.id} className="rounded border bg-zinc-50/60 p-2 text-xs">
                      <div className="font-medium">
                        Installment {p.installment} · €{(p.amountCents / 100).toFixed(2)}
                      </div>
                      <div className="text-muted-foreground">
                        Due {format(p.dueDate, "dd MMM yyyy")}
                        {p.paidAt
                          ? ` · paid ${format(p.paidAt, "dd MMM yyyy")}`
                          : " · unpaid"}
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {student.notes ? (
        <Section title="Internal notes">
          <p className="text-sm whitespace-pre-wrap">{student.notes}</p>
        </Section>
      ) : null}

      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Audit log activity stream — built in Task 3.4c.
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="rounded-lg border bg-white p-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}
