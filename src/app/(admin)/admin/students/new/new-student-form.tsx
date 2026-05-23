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
import { createStudentAction } from "@/lib/actions/students";

const UNASSIGNED = "__none__";
type DocType = "PASSPORT" | "RESIDENCE_PERMIT" | "ID_CARD";

export function NewStudentForm({
  batches,
  onSuccess,
}: {
  batches: Array<{ id: string; label: string }>;
  onSuccess?: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [docType, setDocType] = useState<DocType>("PASSPORT");
  const [docNumber, setDocNumber] = useState("");
  const [dob, setDob] = useState("");
  const [docExpiry, setDocExpiry] = useState("");
  const [nationality, setNationality] = useState("");
  const [nif, setNif] = useState("");
  const [niss, setNiss] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [batchId, setBatchId] = useState<string>(UNASSIGNED);
  const [notes, setNotes] = useState("");
  const [gdpr, setGdpr] = useState(false);
  const [docFront, setDocFront] = useState<File | null>(null);
  const [docBack, setDocBack] = useState<File | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!gdpr) {
      setFieldErrors({ gdprConsent: "GDPR consent is required." });
      return;
    }

    startTransition(async () => {
      const result = await createStudentAction(
        {
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
          gdprConsent: true,
          batchId: batchId === UNASSIGNED ? null : batchId,
          notes: notes || null,
          docFront,
          docBack,
        },
        { requireStaff: true },
      );

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      if (onSuccess) {
        onSuccess(result.id);
      } else {
        router.push(`/admin/students/${result.id}`);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border bg-card p-6"
      encType="multipart/form-data"
    >
      <Section title="Identity">
        <Field label="Full name" error={fieldErrors.fullName} htmlFor="fullName">
          <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" error={fieldErrors.email} htmlFor="email">
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone (WhatsApp)" error={fieldErrors.phone} htmlFor="phone" hint="Include country code, e.g. +351 91 234 5678">
            <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date of birth" error={fieldErrors.dob} htmlFor="dob">
            <Input id="dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Nationality" error={fieldErrors.nationality} htmlFor="nationality">
            <Input id="nationality" required value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Document">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type" error={fieldErrors.docType} htmlFor="docType">
            <Select value={docType} onValueChange={(v) => v && setDocType(v as DocType)}>
              <SelectTrigger id="docType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASSPORT">Passport</SelectItem>
                <SelectItem value="RESIDENCE_PERMIT">Residence permit</SelectItem>
                <SelectItem value="ID_CARD">ID card</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Document number" error={fieldErrors.docNumber} htmlFor="docNumber">
            <Input id="docNumber" required value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
          </Field>
        </div>
        <Field label="Document expiry" error={fieldErrors.docExpiry} htmlFor="docExpiry">
          <Input id="docExpiry" type="date" required value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Document — front (PDF / image)" htmlFor="docFront" hint="Optional. Can be added later.">
            <Input
              id="docFront"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setDocFront(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label="Document — back (optional)" htmlFor="docBack">
            <Input
              id="docBack"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setDocBack(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Tax & address">
        <div className="grid grid-cols-2 gap-4">
          <Field label="NIF (tax ID)" error={fieldErrors.nif} htmlFor="nif">
            <Input id="nif" required value={nif} onChange={(e) => setNif(e.target.value)} />
          </Field>
          <Field label="NISS (social security)" htmlFor="niss" hint="Optional">
            <Input id="niss" value={niss} onChange={(e) => setNiss(e.target.value)} />
          </Field>
        </div>
        <Field label="Address" error={fieldErrors.address} htmlFor="address">
          <Input id="address" required value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="City / town" error={fieldErrors.city} htmlFor="city">
          <Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
      </Section>

      <Section title="Enrolment">
        <Field
          label="Batch"
          htmlFor="batchId"
          error={fieldErrors.batchId}
          hint={
            batches.length === 0
              ? "No upcoming batches available — leave empty and assign later."
              : "Optional. Creates 2 payment rows automatically if set."
          }
        >
          <Select value={batchId} onValueChange={(v) => v && setBatchId(v)}>
            <SelectTrigger id="batchId">
              <SelectValue placeholder="No batch yet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>No batch yet</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Internal notes" htmlFor="notes" hint="Visible to admin/staff only.">
          <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Section>

      <div className="rounded-lg bg-muted border px-4 py-3 flex items-start gap-3">
        <input
          id="gdpr"
          type="checkbox"
          checked={gdpr}
          onChange={(e) => setGdpr(e.target.checked)}
          className="mt-1"
        />
        <label htmlFor="gdpr" className="text-sm">
          Student consents to the use of their personal data per GDPR.{" "}
          {fieldErrors.gdprConsent ? (
            <span className="text-destructive">{fieldErrors.gdprConsent}</span>
          ) : null}
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add student"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
