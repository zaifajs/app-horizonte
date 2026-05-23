import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { EnrollmentPayments } from "./enrollment-payments";
import { ActivityStream } from "./activity-stream";
import { SendMessage } from "./send-message";
import { loadBatchSequence } from "@/lib/students/batch-seq";
import { localeForNationality } from "@/lib/messaging/locale-for-nationality";
import { Avatar } from "@/components/ui/avatar";
import { StudentFormTrigger } from "../student-form-trigger";

const ENROLLMENT_STATUS: Record<string, { color: string; label: string }> = {
  PENDING: { color: "var(--hz-warning)", label: "Pending" },
  ACTIVE: { color: "var(--hz-success)", label: "Active" },
  WITHDRAWN: { color: "var(--hz-ink-3)", label: "Withdrawn" },
  COMPLETED: { color: "var(--hz-info)", label: "Completed" },
};

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [batchSeq, student, formBatchesRaw] = await Promise.all([
    loadBatchSequence(),
    prisma.student.findUnique({
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
    }),
    prisma.batch.findMany({
      where: { status: { in: ["UPCOMING", "ACTIVE"] } },
      orderBy: { startDate: "desc" },
      select: { id: true, code: true, startDate: true, status: true },
    }),
  ]);
  if (!student) notFound();

  const formBatches = formBatchesRaw.map((b) => ({
    id: b.id,
    label: `${b.code} · starts ${b.startDate.toISOString().slice(0, 10)} · ${b.status.toLowerCase()}`,
  }));
  const currentEnrollment = student.enrollments[0] ?? null;
  const editInitial = {
    id: student.id,
    fullName: student.fullName,
    email: student.email,
    phone: student.phone,
    docType: student.docType as "PASSPORT" | "RESIDENCE_PERMIT" | "ID_CARD",
    docNumber: student.docNumber,
    dob: student.dob.toISOString().slice(0, 10),
    docExpiry: student.docExpiry.toISOString().slice(0, 10),
    nationality: student.nationality,
    nif: student.nif,
    niss: student.niss ?? "",
    address: student.address,
    city: student.city,
    notes: student.notes ?? "",
    batchId: currentEnrollment?.batch.id ?? "",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <Avatar name={student.fullName} size={48} fontSize="0.9375rem" />
          <div className="min-w-0">
            <div
              className="text-sm hz-mono uppercase tracking-[.18em]"
              style={{ color: "var(--hz-ink-3)" }}
            >
              Student
            </div>
            <div className="mt-1 flex items-baseline gap-3 flex-wrap">
              <h1 className="font-display text-3xl font-medium">
                {student.fullName}
              </h1>
              {student.enrollments.map((e) => {
                const seq = batchSeq.get(e.id);
                const label = seq ? `${e.batch.code} #${seq}` : e.batch.code;
                const meta = ENROLLMENT_STATUS[e.status] ?? ENROLLMENT_STATUS.PENDING;
                return (
                  <span
                    key={e.id}
                    className="status-pill"
                    style={{ color: meta.color }}
                  >
                    <span className="dot" style={{ background: meta.color }} />
                    {label} · {meta.label}
                  </span>
                );
              })}
            </div>
            <p className="mt-1 hz-mono text-sm" style={{ color: "var(--hz-ink-2)" }}>
              {student.email}
              <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>·</span>
              {student.phone}
              <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>·</span>
              {student.city}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StudentFormTrigger
            mode="edit"
            batches={formBatches}
            initial={editInitial}
            currentBatchCode={currentEnrollment?.batch.code ?? null}
          />
          <Link href="/admin/students" className="btn-ghost">
            Back
          </Link>
        </div>
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
          <p className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
            No enrolments yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {student.enrollments.map((e) => {
              const meta = ENROLLMENT_STATUS[e.status] ?? ENROLLMENT_STATUS.PENDING;
              return (
                <li
                  key={e.id}
                  className="hz-card p-3 text-sm"
                  style={{ background: "var(--hz-surface-2)" }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-medium">
                      Batch{" "}
                      <span style={{ color: "var(--hz-primary)" }} className="hz-mono">
                        {e.batch.code}
                      </span>
                      <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>·</span>
                      <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
                        starts {format(e.batch.startDate, "yyyy-MM-dd")}
                      </span>
                    </div>
                    <span className="status-pill" style={{ color: meta.color }}>
                      <span className="dot" style={{ background: meta.color }} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-3">
                    <EnrollmentPayments
                      enrollmentId={e.id}
                      feeCents={e.batch.course.feeCents}
                      studentId={student.id}
                      studentName={student.fullName}
                      studentEmail={student.email}
                      batchCode={e.batch.code}
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
                    <p
                      className="mt-2 hz-mono text-xs"
                      style={{ color: "var(--hz-warning)" }}
                    >
                      Pending activation — record the first payment to activate.
                    </p>
                  ) : null}
                </li>
              );
            })}
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
      email: true,
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
        studentEmail={data.email}
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
    <section className="space-y-2">
      <h2 className="section-title">{title}</h2>
      <div className="hz-card p-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <div className="hz-mono text-xs uppercase tracking-[.14em]" style={{ color: "var(--hz-ink-3)" }}>
        {label}
      </div>
      <div className="col-span-2 hz-mono" style={{ color: "var(--hz-ink)" }}>
        {value}
      </div>
    </div>
  );
}
