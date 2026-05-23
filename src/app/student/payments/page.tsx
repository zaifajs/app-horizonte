import { format } from "date-fns";
import { loadStudentContext } from "@/lib/student/me";
import { EnrollmentPayments } from "@/app/(admin)/admin/students/[id]/enrollment-payments";

export const dynamic = "force-dynamic";

export const metadata = { title: "Payments · Horizonte CRM" };

export default async function StudentPaymentsPage() {
  const { student, currentEnrollment } = await loadStudentContext();

  if (!student || !currentEnrollment) {
    return (
      <div className="hz-card p-6">
        <p className="hz-mono text-sm" style={{ color: "var(--hz-ink-2)" }}>
          No enrolment to show payments for yet. Once staff places you in a
          batch, your receipts will appear here.
        </p>
      </div>
    );
  }

  const batch = currentEnrollment.batch;

  return (
    <div className="space-y-5">
      <header>
        <div
          className="hz-mono text-xs uppercase tracking-[.18em]"
          style={{ color: "var(--hz-ink-3)" }}
        >
          {batch.course.code} · Batch {batch.code}
        </div>
        <h1 className="font-display text-2xl font-medium mt-1">Payments</h1>
        <p className="hz-mono text-xs mt-1" style={{ color: "var(--hz-ink-3)" }}>
          Enrolled {format(currentEnrollment.enrolledAt, "dd MMM yyyy")}
        </p>
      </header>

      <EnrollmentPayments
        readOnly
        enrollmentId={currentEnrollment.id}
        feeCents={batch.course.feeCents}
        studentId={student.id}
        studentName={student.fullName}
        payments={currentEnrollment.payments.map((p) => ({
          id: p.id,
          amountCents: p.amountCents,
          paidAt: p.paidAt,
          method: p.method,
          notes: p.notes,
          hasProof: !!p.proofStoragePath,
        }))}
      />
    </div>
  );
}
