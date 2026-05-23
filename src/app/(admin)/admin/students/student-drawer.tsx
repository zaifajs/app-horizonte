"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (!studentId) {
      startTransition(() => { setData(null); });
      return;
    }
    startTransition(async () => {
      const result = await getStudentForDrawer(studentId);
      setData(result);
    });
  }, [studentId]);

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
          <DrawerContent data={data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerContent({ data }: { data: DrawerData }) {
  const enr = data.enrollments[0] ?? null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-semibold tracking-tight">{data.fullName}</h2>
          {data.enrollments.map((e) => {
            const label = e.batchSeq ? `${e.batchCode} #${e.batchSeq}` : e.batchCode;
            return (
              <Badge
                key={e.id}
                variant="outline"
                className={
                  e.status === "PENDING"
                    ? "chip chip-warning"
                    : e.status === "ACTIVE"
                      ? "chip chip-success"
                      : ""
                }
              >
                {label} · {e.status.toLowerCase()}
              </Badge>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          {data.email} · {data.phone} · {data.city}
        </p>
        <div className="flex gap-2 pt-1">
          <a href={`/admin/students/${data.id}`}>
            <Button variant="outline" size="sm">View full details</Button>
          </a>
        </div>
      </header>

      <section className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">Personal</h3>
        <div className="rounded-lg border bg-card p-4 text-sm space-y-1">
          <RowKV k="Date of birth" v={format(new Date(data.dob), "dd MMM yyyy")} />
          <RowKV k="Nationality" v={data.nationality} />
          <RowKV k="Address" v={`${data.address}, ${data.city}`} />
          <RowKV k="NIF" v={data.nif} />
          <RowKV k="NISS" v={data.niss ?? "—"} />
          <RowKV
            k="Document"
            v={`${data.docType.replace("_", " ").toLowerCase()} · ${data.docNumber}`}
          />
          <RowKV k="Doc expiry" v={format(new Date(data.docExpiry), "dd MMM yyyy")} />
        </div>
      </section>

      {enr ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold tracking-tight">Payments</h3>
          <div className="rounded-lg border bg-card p-4">
            <EnrollmentPayments
              enrollmentId={enr.id}
              feeCents={enr.feeCents}
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

      <section className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">Send message</h3>
        <div className="rounded-lg border bg-card p-4">
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
    <div className="grid grid-cols-3 gap-2 py-1">
      <div className="text-muted-foreground">{k}</div>
      <div className="col-span-2">{v}</div>
    </div>
  );
}
