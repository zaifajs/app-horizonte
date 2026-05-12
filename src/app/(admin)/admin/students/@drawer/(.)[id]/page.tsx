// Intercepts /admin/students/[id] when the user navigates from the list,
// rendering the detail in a side sheet instead of replacing the page.
// Direct hits to /admin/students/[id] (refresh, deep link, mobile click)
// still fall through to the regular detail page.

import { notFound } from "next/navigation";
import { format } from "date-fns";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { EnrollmentPayments } from "../../[id]/enrollment-payments";
import { SendMessage } from "../../[id]/send-message";
import { loadBatchSequence } from "@/lib/students/batch-seq";
import { localeForNationality } from "@/lib/messaging/locale-for-nationality";
import { StudentDrawerShell } from "./drawer-shell";

export const dynamic = "force-dynamic";

export default async function InterceptedStudentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [student, batchSeq] = await Promise.all([
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
    loadBatchSequence(),
  ]);
  if (!student) notFound();

  const enr = student.enrollments[0] ?? null;
  const loc = localeForNationality(student.nationality);

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
    <StudentDrawerShell title={student.fullName} studentId={student.id}>
      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-semibold tracking-tight">
            {student.fullName}
          </h2>
          {student.enrollments.map((e) => {
            const seq = batchSeq.get(e.id);
            const label = seq ? `${e.batch.code} #${seq}` : e.batch.code;
            return (
              <Badge
                key={e.id}
                variant="outline"
                className={
                  e.status === "PENDING"
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : e.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                      : ""
                }
              >
                {label} · {e.status.toLowerCase()}
              </Badge>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          {student.email} · {student.phone} · {student.city}
        </p>
        <div className="flex gap-2 pt-1">
          {/* Hard <a> so it escapes the drawer-intercept and loads the real page. */}
          <a href={`/admin/students/${student.id}`}>
            <Button variant="outline" size="sm">
              View full details
            </Button>
          </a>
        </div>
      </header>

      <section className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">Personal</h3>
        <div className="rounded-lg border bg-white p-4 text-sm space-y-1">
          <RowKV k="Date of birth" v={format(student.dob, "dd MMM yyyy")} />
          <RowKV k="Nationality" v={student.nationality} />
          <RowKV k="Address" v={`${student.address}, ${student.city}`} />
          <RowKV k="NIF" v={student.nif} />
          <RowKV k="NISS" v={student.niss ?? "—"} />
          <RowKV
            k="Document"
            v={`${student.docType.replace("_", " ").toLowerCase()} · ${student.docNumber}`}
          />
          <RowKV k="Doc expiry" v={format(student.docExpiry, "dd MMM yyyy")} />
        </div>
      </section>

      {enr ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold tracking-tight">Payments</h3>
          <div className="rounded-lg border bg-white p-4">
            <EnrollmentPayments
              enrollmentId={enr.id}
              feeCents={enr.batch.course.feeCents}
              payments={enr.payments.map((p) => ({
                id: p.id,
                amountCents: p.amountCents,
                paidAt: p.paidAt,
                method: p.method,
                notes: p.notes,
                hasProof: !!p.proofStoragePath,
              }))}
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">Send message</h3>
        <div className="rounded-lg border bg-white p-4">
          <SendMessage
            studentId={student.id}
            studentName={student.fullName}
            studentPhone={student.phone}
            studentEmail={student.email}
            locale={loc}
            nationalityLabel={student.nationality}
            vars={{
              name: student.fullName.split(" ")[0],
              batch: batchCode,
              startDate: startDateStr,
              dueAmount: dueAmountStr,
              nextSessionDate: "tomorrow",
              scheduleUrl,
            }}
          />
        </div>
      </section>

    </StudentDrawerShell>
  );
}

function RowKV({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1">
      <div className="text-muted-foreground">{k}</div>
      <div className="col-span-2">{v}</div>
    </div>
  );
}
