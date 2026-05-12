import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { EnrollmentPayments } from "./enrollment-payments";
import { ActivityStream } from "./activity-stream";
import { SendMessage } from "./send-message";
import { loadBatchSequence } from "@/lib/students/batch-seq";
import { localeForNationality } from "@/lib/messaging/locale-for-nationality";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const batchSeq = await loadBatchSequence();
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { uploadedAt: "desc" } },
      enrollments: {
        include: {
          batch: {
            select: {
              id: true,
              code: true,
              startDate: true,
              course: { select: { feeCents: true } },
            },
          },
          payments: { orderBy: { paidAt: "asc" } },
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
            {student.enrollments.map((e) => {
              const seq = batchSeq.get(e.id);
              const label = seq ? `${e.batch.code} #${seq}` : e.batch.code;
              return (
                <EnrollmentStatusBadge key={e.id} status={e.status} batch={label} />
              );
            })}
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
                <div className="mt-3">
                  <EnrollmentPayments
                    enrollmentId={e.id}
                    feeCents={e.batch.course.feeCents}
                    payments={e.payments.map((p) => ({
                      id: p.id,
                      amountCents: p.amountCents,
                      paidAt: p.paidAt,
                      method: p.method,
                      notes: p.notes,
                      hasProof: !!p.proofStoragePath,
                    }))}
                  />
                </div>
                {e.status === "PENDING" ? (
                  <p className="mt-2 text-[11px] text-amber-700">
                    This enrollment is <span className="font-semibold">pending activation</span>.
                    Record the first payment to activate.
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

      <MessagingSection studentId={student.id} />

      <Section title="Activity">
        <ActivityStream studentId={student.id} />
      </Section>
    </div>
  );
}

async function MessagingSection({ studentId }: { studentId: string }) {
  const data = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      nationality: true,
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        take: 1,
        select: {
          id: true,
          batch: {
            select: {
              id: true,
              code: true,
              startDate: true,
              course: { select: { feeCents: true } },
            },
          },
          payments: { select: { amountCents: true } },
        },
      },
    },
  });
  if (!data) return null;
  const loc = localeForNationality(data.nationality);

  const enr = data.enrollments[0] ?? null;
  let dueAmountStr = "";
  let startDateStr = "";
  let scheduleUrl: string | undefined;
  let batchCode = "—";
  if (enr) {
    const paid = enr.payments.reduce((a, p) => a + p.amountCents, 0);
    const due = Math.max(0, enr.batch.course.feeCents - paid);
    dueAmountStr = `€${(due / 100).toFixed(2)}`;
    startDateStr = enr.batch.startDate.toISOString().slice(0, 10);
    batchCode = enr.batch.code;

    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("host") ?? "stage.nhorizonte.pt";
    scheduleUrl = `${proto}://${host}/${loc}/turma/${enr.batch.id}`;
  }

  return (
    <Section title="Send message">
      <SendMessage
        studentId={data.id}
        studentName={data.fullName}
        studentPhone={data.phone}
        locale={loc}
        nationalityLabel={data.nationality}
        vars={{
          name: data.fullName.split(" ")[0],
          batch: batchCode,
          startDate: startDateStr,
          dueAmount: dueAmountStr,
          nextSessionDate: "tomorrow",
          scheduleUrl,
        }}
      />
    </Section>
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
