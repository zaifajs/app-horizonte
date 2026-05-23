"use client";

import { useMemo, useState, useTransition } from "react";
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
  wizard: {
    stepLabel: string;
    next: string;
    back: string;
    incomplete: string;
    gdprTitle: string;
    gdprBody: string;
  };
  success: { title: string; body: string; again: string };
};

// 4-step wizard. Each step lists the fields the user fills, plus the
// validation function that gates "Next" / "Submit". The actual server-side
// validation still runs on submit — these are just early UX checks so the
// user doesn't hit a wall on the last step.
type StepKey = "identity" | "document" | "address" | "enrolment";

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
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

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

  const steps: { key: StepKey; title: string; isValid: () => boolean }[] = useMemo(
    () => [
      {
        key: "identity",
        title: t.sections.identity,
        isValid: () =>
          fullName.trim().length > 0 &&
          email.trim().length > 0 &&
          phone.trim().length > 0 &&
          dob.length > 0 &&
          nationality.trim().length > 0,
      },
      {
        key: "document",
        title: t.sections.document,
        isValid: () =>
          docNumber.trim().length > 0 && docExpiry.length > 0,
      },
      {
        key: "address",
        title: t.sections.address,
        isValid: () =>
          nif.trim().length > 0 &&
          address.trim().length > 0 &&
          city.trim().length > 0,
      },
      {
        key: "enrolment",
        title: t.sections.enrolment,
        // GDPR is checked on submit, not as a "Next" gate (it's the final step).
        isValid: () => true,
      },
    ],
    [
      t.sections,
      fullName, email, phone, dob, nationality,
      docNumber, docExpiry,
      nif, address, city,
    ],
  );

  const totalSteps = steps.length;
  const isLast = stepIndex === totalSteps - 1;
  const current = steps[stepIndex];
  const stepLabel = t.wizard.stepLabel
    .replace("{n}", String(stepIndex + 1))
    .replace("{total}", String(totalSteps));

  function goNext() {
    setStepError(null);
    if (!current.isValid()) {
      setStepError(t.wizard.incomplete);
      return;
    }
    setStepIndex((s) => Math.min(totalSteps - 1, s + 1));
  }

  function goBack() {
    setStepError(null);
    setStepIndex((s) => Math.max(0, s - 1));
  }

  function reset() {
    setFullName(""); setEmail(""); setPhone(""); setDocNumber("");
    setDob(""); setDocExpiry(""); setNationality(""); setNif("");
    setNiss(""); setAddress(""); setCity("");
    setBatchId(batches[0]?.id ?? UNASSIGNED);
    setGdpr(false); setDocFront(null); setDocBack(null);
    setError(null); setFieldErrors({}); setDone(false);
    setStepIndex(0); setStepError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setStepError(null);
    if (!gdpr) {
      setStepError(t.fields.gdpr);
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
      className="space-y-5"
      encType="multipart/form-data"
    >
      {/* Step indicator. Numbered pills with a connector — desktop shows
          full titles; phones collapse to numbers + the current label so the
          progress is always visible at a glance. */}
      <ol
        className="flex items-center gap-2"
        aria-label={stepLabel}
      >
        {steps.map((s, i) => {
          const reached = i <= stepIndex;
          const active = i === stepIndex;
          return (
            <li key={s.key} className="flex items-center gap-2 flex-1 min-w-0">
              <button
                type="button"
                // Only allow jumping back to already-visited steps. Forward
                // jumps require passing the validation gate via Next.
                onClick={() => {
                  if (i < stepIndex) {
                    setStepIndex(i);
                    setStepError(null);
                  }
                }}
                disabled={i > stepIndex}
                className="flex items-center gap-2 text-left min-w-0"
                style={{
                  cursor: i < stepIndex ? "pointer" : "default",
                  opacity: reached ? 1 : 0.5,
                }}
              >
                <span
                  className="inline-flex items-center justify-center rounded-full hz-mono text-xs font-semibold shrink-0"
                  style={{
                    width: 24,
                    height: 24,
                    background: active
                      ? "var(--hz-primary)"
                      : reached
                        ? "var(--hz-primary-50)"
                        : "var(--hz-surface-2)",
                    color: active ? "var(--hz-ink)" : "var(--hz-ink-2)",
                    border: `1px solid ${active || reached ? "var(--hz-primary)" : "var(--hz-line)"}`,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  className={`text-sm hz-mono uppercase tracking-[.12em] truncate ${active ? "" : "hidden sm:inline"}`}
                  style={{ color: active ? "var(--hz-ink)" : "var(--hz-ink-3)" }}
                >
                  {s.title}
                </span>
              </button>
              {i < totalSteps - 1 ? (
                <span
                  aria-hidden
                  className="hidden sm:block flex-1"
                  style={{
                    height: 1,
                    background: i < stepIndex ? "var(--hz-primary)" : "var(--hz-line)",
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p
        className="hz-mono text-xs"
        style={{ color: "var(--hz-ink-3)" }}
      >
        {stepLabel}
      </p>

      <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-5">
        {/* ============ Step 1: Identity ============ */}
        {current.key === "identity" ? (
          <>
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
          </>
        ) : null}

        {/* ============ Step 2: Document ============ */}
        {current.key === "document" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t.fields.docType} htmlFor="docType" error={fieldErrors.docType}>
                <Select value={docType} onValueChange={(v) => v && setDocType(v as DocType)}>
                  <SelectTrigger id="docType">
                    <SelectValue>
                      {(v: string) =>
                        v === "PASSPORT"
                          ? t.docTypes.PASSPORT
                          : v === "RESIDENCE_PERMIT"
                          ? t.docTypes.RESIDENCE_PERMIT
                          : v === "ID_CARD"
                          ? t.docTypes.ID_CARD
                          : ""
                      }
                    </SelectValue>
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
          </>
        ) : null}

        {/* ============ Step 3: Address & tax ============ */}
        {current.key === "address" ? (
          <>
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
          </>
        ) : null}

        {/* ============ Step 4: Enrolment + GDPR ============ */}
        {current.key === "enrolment" ? (
          <>
            <Field
              label={t.fields.batch}
              htmlFor="batchId"
              error={fieldErrors.batchId}
              hint={batches.length === 0 ? t.fields.noBatches : undefined}
            >
              <Select value={batchId} onValueChange={(v) => v && setBatchId(v)}>
                <SelectTrigger id="batchId">
                  <SelectValue>
                    {(v: string) => {
                      if (!v || v === UNASSIGNED) return "—";
                      const b = batches.find((x) => x.id === v);
                      return b ? b.label : "—";
                    }}
                  </SelectValue>
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

            {/* Promoted GDPR panel — was previously a small checkbox at the
                bottom of the page that mobile users would scroll past or
                miss. Now lives on its own surface as the last gate before
                submit, with clear copy and a generous tap target. */}
            <div
              className="rounded-lg p-4 sm:p-5 space-y-3"
              style={{
                background: gdpr ? "var(--hz-primary-50)" : "var(--hz-surface-2)",
                border: `1px solid ${gdpr ? "var(--hz-primary)" : "var(--hz-line)"}`,
                transition: "background 150ms, border-color 150ms",
              }}
            >
              <div>
                <h3
                  className="font-display text-base font-medium"
                  style={{ color: "var(--hz-ink)" }}
                >
                  {t.wizard.gdprTitle}
                </h3>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--hz-ink-2)", lineHeight: 1.5 }}
                >
                  {t.wizard.gdprBody}
                </p>
              </div>
              <label
                htmlFor="gdpr"
                className="flex items-start gap-3 cursor-pointer rounded-md p-3"
                style={{
                  background: "var(--hz-surface)",
                  border: `1px solid ${gdpr ? "var(--hz-primary)" : "var(--hz-line)"}`,
                }}
              >
                <input
                  id="gdpr"
                  type="checkbox"
                  checked={gdpr}
                  onChange={(e) => {
                    setGdpr(e.target.checked);
                    if (e.target.checked) setStepError(null);
                  }}
                  className="hz-cb mt-0.5"
                  required
                />
                <span
                  className="text-sm"
                  style={{ color: "var(--hz-ink)", lineHeight: 1.4 }}
                >
                  {t.fields.gdpr}
                </span>
              </label>
            </div>
          </>
        ) : null}

        {stepError ? (
          <p className="text-sm text-destructive" role="alert">
            {stepError}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {/* Wizard footer — Back / spacer / Next or Submit */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={stepIndex === 0 || pending}
        >
          {t.wizard.back}
        </Button>
        {isLast ? (
          <Button type="submit" disabled={pending || batches.length === 0 || !gdpr}>
            {pending ? t.submitting : t.submit}
          </Button>
        ) : (
          <Button type="button" onClick={goNext} disabled={pending}>
            {t.wizard.next}
          </Button>
        )}
      </div>
    </form>
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
