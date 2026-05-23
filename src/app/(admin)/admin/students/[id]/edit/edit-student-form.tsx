"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateStudentAction } from "@/lib/actions/students";

type DocType = "PASSPORT" | "RESIDENCE_PERMIT" | "ID_CARD";

type Initial = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  docType: DocType;
  docNumber: string;
  dob: string;
  docExpiry: string;
  nationality: string;
  nif: string;
  niss: string;
  address: string;
  city: string;
  notes: string;
  batchId: string;
};

const KEEP_BATCH = "__keep__";

export function EditStudentForm({
  initial,
  batches,
  currentBatchCode,
  onSuccess,
}: {
  initial: Initial;
  batches: Array<{ id: string; label: string }>;
  currentBatchCode: string | null;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState(initial.fullName);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [docType, setDocType] = useState<DocType>(initial.docType);
  const [docNumber, setDocNumber] = useState(initial.docNumber);
  const [dob, setDob] = useState(initial.dob);
  const [docExpiry, setDocExpiry] = useState(initial.docExpiry);
  const [nationality, setNationality] = useState(initial.nationality);
  const [nif, setNif] = useState(initial.nif);
  const [niss, setNiss] = useState(initial.niss);
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [notes, setNotes] = useState(initial.notes);
  const [batchId, setBatchId] = useState<string>(initial.batchId || KEEP_BATCH);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateStudentAction({
        id: initial.id,
        fullName,
        email,
        phone,
        docType,
        docNumber,
        dob,
        docExpiry,
        nationality,
        nif,
        niss: niss || null,
        address,
        city,
        notes: notes || null,
        batchId: batchId === KEEP_BATCH ? null : batchId,
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/admin/students/${initial.id}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl border bg-card p-6">
      <SectionNav
        sections={[
          { id: "sec-batch", title: "Batch" },
          { id: "sec-identity", title: "Identity" },
          { id: "sec-document", title: "Document" },
          { id: "sec-tax", title: "Tax & address" },
          { id: "sec-notes", title: "Notes" },
        ]}
      />

      {/* Batch first — it's the single most common edit (fix wrong batch).
          Avoids scrolling past 12 other fields. */}
      <Section title="Batch" id="sec-batch">
        <Field
          label="Move to batch"
          htmlFor="batchId"
          error={fieldErrors.batchId}
        >
          <Select value={batchId} onValueChange={(v) => v && setBatchId(v)}>
            <SelectTrigger id="batchId">
              <SelectValue placeholder="No batch">
                {(v: string) => {
                  if (v === KEEP_BATCH)
                    return currentBatchCode ? `Keep current — ${currentBatchCode}` : "No batch";
                  const b = batches.find((x) => x.id === v);
                  return b ? b.label : "No batch";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={KEEP_BATCH}>
                {currentBatchCode ? `Keep current — ${currentBatchCode}` : "No batch"}
              </SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Selecting a different batch moves the student there. Existing payments stay attached.
          </p>
        </Field>
      </Section>

      <Section title="Identity" id="sec-identity">
        <Field label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
          <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" htmlFor="email" error={fieldErrors.email}>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone (WhatsApp)" htmlFor="phone" error={fieldErrors.phone}>
            <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date of birth" htmlFor="dob" error={fieldErrors.dob}>
            <Input id="dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Nationality" htmlFor="nationality" error={fieldErrors.nationality}>
            <Input id="nationality" required value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Document" id="sec-document">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type" htmlFor="docType" error={fieldErrors.docType}>
            <Select value={docType} onValueChange={(v) => v && setDocType(v as DocType)}>
              <SelectTrigger id="docType">
                <SelectValue>
                  {(v: string) =>
                    v === "PASSPORT"
                      ? "Passport"
                      : v === "RESIDENCE_PERMIT"
                      ? "Residence permit"
                      : v === "ID_CARD"
                      ? "ID card"
                      : "Select document type"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASSPORT">Passport</SelectItem>
                <SelectItem value="RESIDENCE_PERMIT">Residence permit</SelectItem>
                <SelectItem value="ID_CARD">ID card</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Document number" htmlFor="docNumber" error={fieldErrors.docNumber}>
            <Input id="docNumber" required value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
          </Field>
        </div>
        <Field label="Document expiry" htmlFor="docExpiry" error={fieldErrors.docExpiry}>
          <Input id="docExpiry" type="date" required value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} />
        </Field>
      </Section>

      <Section title="Tax & address" id="sec-tax">
        <div className="grid grid-cols-2 gap-4">
          <Field label="NIF" htmlFor="nif" error={fieldErrors.nif}>
            <Input id="nif" required value={nif} onChange={(e) => setNif(e.target.value)} />
          </Field>
          <Field label="NISS" htmlFor="niss">
            <Input id="niss" value={niss} onChange={(e) => setNiss(e.target.value)} />
          </Field>
        </div>
        <Field label="Address" htmlFor="address" error={fieldErrors.address}>
          <Input id="address" required value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="City / town" htmlFor="city" error={fieldErrors.city}>
          <Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
      </Section>

      <Section title="Internal notes" id="sec-notes">
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible to admin/staff only." />
      </Section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div
        className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 flex justify-end gap-2 hair-t"
        style={{
          background: "var(--hz-surface)",
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
        }}
      >
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset id={id} className="space-y-4 scroll-mt-4">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function SectionNav({
  sections,
}: {
  sections: { id: string; title: string }[];
}) {
  return (
    <nav
      aria-label="Form sections"
      className="sticky top-0 -mx-6 px-6 py-2 flex items-center gap-1.5 overflow-x-auto hair-b"
      style={{ background: "var(--hz-surface)", zIndex: 1 }}
    >
      {sections.map((s, i) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="chip chip-outline text-xs shrink-0"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <span className="hz-mono" style={{ color: "var(--hz-ink-3)" }}>
            {i + 1}.
          </span>{" "}
          {s.title}
        </a>
      ))}
    </nav>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
