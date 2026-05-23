"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Translations = {
  sections: { identity: string; document: string; address: string; enrolment: string; consent: string };
  fields: {
    fullName: string; email: string; phone: string; phoneHint: string;
    dob: string; nationality: string; docType: string; docNumber: string;
    docExpiry: string; docFront: string; docBack: string;
    nif: string; niss: string; address: string; city: string;
    batch: string; noBatches: string; gdpr: string;
  };
  docTypes: { PASSPORT: string; RESIDENCE_PERMIT: string; ID_CARD: string };
  submit: string;
  submitting: string;
  success: { title: string; body: string; again: string };
};

export function RegisterForm({
  batches,
  t,
}: {
  batches: Array<{ id: string; label: string }>;
  t: Translations;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

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
  const [batchId, setBatchId] = useState<string>(
    batches[0]?.id ?? UNASSIGNED,
  );
  const [gdpr, setGdpr] = useState(false);
  const [docFront, setDocFront] = useState<File | null>(null);
  const [docBack, setDocBack] = useState<File | null>(null);

  function reset() {
    setFullName(""); setEmail(""); setPhone(""); setDocNumber("");
    setDob(""); setDocExpiry(""); setNationality(""); setNif("");
    setNiss(""); setAddress(""); setCity("");
    setBatchId(batches[0]?.id ?? UNASSIGNED);
    setGdpr(false); setDocFront(null); setDocBack(null);
    setError(null); setFieldErrors({}); setDone(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!gdpr) {
      setFieldErrors({ gdprConsent: t.fields.gdpr });
      return;
    }
    startTransition(async () => {
      const result = await createStudentAction({
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
        notes: null,
        docFront,
        docBack,
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border chip chip-success p-4 sm:p-6 space-y-3">
        <h2 className="text-lg font-semibold text-[var(--hz-success)]">
          {t.success.title}
        </h2>
        <p className="text-sm text-[var(--hz-success)]/80">{t.success.body}</p>
        <Button onClick={reset} variant="outline">
          {t.success.again}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border bg-card p-4 sm:p-6"
      encType="multipart/form-data"
    >
      <Section title={t.sections.identity}>
        <Field label={t.fields.fullName} htmlFor="fullName" error={fieldErrors.fullName}>
          <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t.fields.email} htmlFor="email" error={fieldErrors.email}>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t.fields.phone} htmlFor="phone" error={fieldErrors.phone} hint={t.fields.phoneHint}>
            <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t.fields.dob} htmlFor="dob" error={fieldErrors.dob}>
            <Input id="dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label={t.fields.nationality} htmlFor="nationality" error={fieldErrors.nationality}>
            <Input id="nationality" required value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title={t.sections.document}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t.fields.docType} htmlFor="docType" error={fieldErrors.docType}>
            <Select value={docType} onValueChange={(v) => v && setDocType(v as DocType)}>
              <SelectTrigger id="docType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASSPORT">{t.docTypes.PASSPORT}</SelectItem>
                <SelectItem value="RESIDENCE_PERMIT">{t.docTypes.RESIDENCE_PERMIT}</SelectItem>
                <SelectItem value="ID_CARD">{t.docTypes.ID_CARD}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.fields.docNumber} htmlFor="docNumber" error={fieldErrors.docNumber}>
            <Input id="docNumber" required value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
          </Field>
        </div>
        <Field label={t.fields.docExpiry} htmlFor="docExpiry" error={fieldErrors.docExpiry}>
          <Input id="docExpiry" type="date" required value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t.fields.docFront} htmlFor="docFront">
            <Input
              id="docFront"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setDocFront(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label={t.fields.docBack} htmlFor="docBack">
            <Input
              id="docBack"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setDocBack(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
      </Section>

      <Section title={t.sections.address}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t.fields.nif} htmlFor="nif" error={fieldErrors.nif}>
            <Input id="nif" required value={nif} onChange={(e) => setNif(e.target.value)} />
          </Field>
          <Field label={t.fields.niss} htmlFor="niss">
            <Input id="niss" value={niss} onChange={(e) => setNiss(e.target.value)} />
          </Field>
        </div>
        <Field label={t.fields.address} htmlFor="address" error={fieldErrors.address}>
          <Input id="address" required value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label={t.fields.city} htmlFor="city" error={fieldErrors.city}>
          <Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
      </Section>

      <Section title={t.sections.enrolment}>
        <Field
          label={t.fields.batch}
          htmlFor="batchId"
          error={fieldErrors.batchId}
          hint={batches.length === 0 ? t.fields.noBatches : undefined}
        >
          <Select value={batchId} onValueChange={(v) => v && setBatchId(v)}>
            <SelectTrigger id="batchId">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {batches.length === 0 ? (
                <SelectItem value={UNASSIGNED} disabled>
                  {t.fields.noBatches}
                </SelectItem>
              ) : (
                <>
                  <SelectItem value={UNASSIGNED}>—</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
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
          {t.fields.gdpr}
        </label>
      </div>
      {fieldErrors.gdprConsent ? (
        <p className="text-sm text-destructive">{fieldErrors.gdprConsent}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || batches.length === 0}>
          {pending ? t.submitting : t.submit}
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
