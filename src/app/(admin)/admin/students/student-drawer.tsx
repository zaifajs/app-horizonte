"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getStudentForDrawer } from "@/lib/actions/students";
import { EnrollmentPayments } from "./[id]/enrollment-payments";
import { SendMessage } from "./[id]/send-message";
import { Avatar } from "@/components/ui/avatar";

type DrawerData = NonNullable<Awaited<ReturnType<typeof getStudentForDrawer>>>;

export function StudentDrawer({
  studentId,
  onClose,
}: {
  studentId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<DrawerData | null>(null);
  const [, startTransition] = useTransition();

  // Refetch on demand. Used by EnrollmentPayments after add/delete so the
  // drawer's snapshot of payments matches what just hit the server —
  // router.refresh() alone only revalidates server components, not the
  // useState in this client component.
  const refetch = useCallback(() => {
    if (!studentId) return;
    startTransition(async () => {
      const result = await getStudentForDrawer(studentId);
      setData(result);
    });
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      startTransition(() => { setData(null); });
      return;
    }
    refetch();
  }, [studentId, refetch]);

  return (
    <Sheet open={!!studentId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="!w-full sm:!max-w-none md:!w-1/2 overflow-y-auto p-6"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{data?.fullName ?? "Student"}</SheetTitle>
          <SheetDescription>Student detail</SheetDescription>
        </SheetHeader>

        {!data ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : (
          <DrawerContent data={data} onMutate={refetch} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerContent({ data, onMutate }: { data: DrawerData; onMutate: () => void }) {
  const enr = data.enrollments[0] ?? null;
  const statusTone: Record<string, { color: string; label: string }> = {
    PENDING: { color: "var(--hz-warning)", label: "Pending" },
    ACTIVE: { color: "var(--hz-success)", label: "Active" },
    WITHDRAWN: { color: "var(--hz-ink-3)", label: "Withdrawn" },
    COMPLETED: { color: "var(--hz-info)", label: "Completed" },
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Avatar name={data.fullName} size={44} fontSize="0.875rem" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-2xl font-medium">{data.fullName}</h2>
            {data.enrollments.map((e) => {
              const label = e.batchSeq ? `${e.batchCode} #${e.batchSeq}` : e.batchCode;
              const meta = statusTone[e.status] ?? statusTone.PENDING;
              return (
                <span key={e.id} className="status-pill" style={{ color: meta.color }}>
                  <span className="dot" style={{ background: meta.color }} />
                  {label} · {meta.label}
                </span>
              );
            })}
          </div>
          <p className="mt-1 hz-mono text-xs" style={{ color: "var(--hz-ink-2)" }}>
            {data.email}
            <span className="mx-1.5" style={{ color: "var(--hz-ink-3)" }}>·</span>
            {data.phone}
            <span className="mx-1.5" style={{ color: "var(--hz-ink-3)" }}>·</span>
            {data.city}
          </p>
          <div className="flex gap-2 pt-2 flex-wrap">
            <a
              href={`/admin/students/${data.id}/edit`}
              className="btn-primary text-sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </a>
            <button
              type="button"
              onClick={() => {
                document
                  .getElementById("drawer-send-message")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="btn-ghost text-sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              Message
            </button>
            <a
              href={`/admin/students/${data.id}`}
              className="btn-ghost text-sm"
            >
              View full details
            </a>
          </div>
        </div>
      </header>

      <section className="space-y-2">
        <h3 className="section-title">Personal</h3>
        <div className="hz-card p-4 space-y-0.5">
          <RowKV k="Date of birth" v={format(new Date(data.dob), "yyyy-MM-dd")} />
          <RowKV k="Nationality" v={data.nationality} />
          <RowKV k="Address" v={`${data.address}, ${data.city}`} />
          <RowKV k="NIF" v={data.nif} />
          <RowKV k="NISS" v={data.niss ?? "—"} />
          <RowKV
            k="Document"
            v={`${data.docType.replace("_", " ").toLowerCase()} · ${data.docNumber}`}
          />
          <RowKV k="Doc expiry" v={format(new Date(data.docExpiry), "yyyy-MM-dd")} />
        </div>
      </section>

      {enr ? (
        <section className="space-y-2">
          <h3 className="section-title">Payments</h3>
          <div className="hz-card p-4">
            <EnrollmentPayments
              enrollmentId={enr.id}
              feeCents={enr.feeCents}
              studentId={data.id}
              studentName={data.fullName}
              studentEmail={data.email}
              batchCode={enr.batchCode}
              onMutate={onMutate}
              payments={enr.payments.map((p) => ({
                id: p.id,
                amountCents: p.amountCents,
                paidAt: new Date(p.paidAt),
                method: p.method as Parameters<typeof EnrollmentPayments>[0]["payments"][0]["method"],
                notes: p.notes,
                hasProof: p.hasProof,
              }))}
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-2" id="drawer-send-message">
        <h3 className="section-title">Send message</h3>
        <div className="hz-card p-4">
          <SendMessage
            studentId={data.id}
            studentName={data.fullName}
            studentPhone={data.phone}
            studentEmail={data.email}
            locale={data.locale}
            nationalityLabel={data.nationality}
            vars={data.vars}
          />
        </div>
      </section>
    </div>
  );
}

function RowKV({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <div
        className="hz-mono text-xs uppercase tracking-[.14em]"
        style={{ color: "var(--hz-ink-3)" }}
      >
        {k}
      </div>
      <div className="col-span-2 hz-mono" style={{ color: "var(--hz-ink)" }}>
        {v}
      </div>
    </div>
  );
}
