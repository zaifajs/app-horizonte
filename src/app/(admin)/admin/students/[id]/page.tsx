import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { PaymentRow } from "./payment-row";

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
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">
              {student.fullName}
            </h1>
            {student.enrollments.map((e) => (
              <EnrollmentStatusBadge key={e.id} status={e.status} batch={e.batch.code} />
            ))}
          </div>
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
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {e.payments.map((p) => (
                    <PaymentRow
                      key={p.id}
                      payment={{
                        id: p.id,
                        installment: p.installment,
                        amountCents: p.amountCents,
                        dueDate: p.dueDate,
                        paidAt: p.paidAt,
                        method: p.method,
                      }}
                    />
                  ))}
                </div>
                {e.status === "PENDING" ? (
                  <p className="mt-2 text-[11px] text-amber-700">
                    This enrollment is <span className="font-semibold">pending activation</span>.
                    Mark installment 1 as paid to activate.
                  </p>
                ) : null}
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

function EnrollmentStatusBadge({
  status,
  batch,
}: {
  status: "PENDING" | "ACTIVE" | "WITHDRAWN" | "COMPLETED";
  batch: string;
}) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-900 border-amber-300",
    ACTIVE: "bg-emerald-100 text-emerald-900 border-emerald-300",
    WITHDRAWN: "bg-zinc-100 text-zinc-700 border-zinc-300",
    COMPLETED: "bg-sky-100 text-sky-900 border-sky-300",
  };
  return (
    <Badge variant="outline" className={styles[status]}>
      {batch} · {status.toLowerCase()}
    </Badge>
  );
}
