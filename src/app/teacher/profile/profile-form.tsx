"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  saveTeacherProfileAction,
  uploadTeacherFileAction,
} from "@/lib/actions/teacher-profile";
import { SUPPORTED_LOCALES, type TeacherLocale } from "@/lib/validators/teacher-profile";

const LOCALE_LABEL: Record<TeacherLocale, string> = {
  pt: "Português",
  en: "English",
  bn: "বাংলা",
  ur: "اردو",
  hi: "हिन्दी",
};

export function TeacherProfileForm({
  initial,
  // Optional admin override — when set, the form posts on behalf of another
  // teacher. Defaults to self-service (no userId in payload).
  forUserId,
}: {
  initial: {
    name: string;
    bio: string;
    phone: string;
    languages: string; // comma-separated locale codes
    photoUrl: string | null;
    cvUrl: string | null;
    updatedAt: string | null;
  };
  forUserId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [phone, setPhone] = useState(initial.phone);
  const [languages, setLanguages] = useState<Set<TeacherLocale>>(() => {
    const set = new Set<TeacherLocale>();
    for (const l of initial.languages.split(",")) {
      const t = l.trim().toLowerCase();
      if ((SUPPORTED_LOCALES as readonly string[]).includes(t)) {
        set.add(t as TeacherLocale);
      }
    }
    return set;
  });

  function toggleLanguage(l: TeacherLocale) {
    setLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return next;
    });
  }

  function onSave() {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const result = await saveTeacherProfileAction({
        userId: forUserId,
        name,
        bio,
        phone,
        languages: Array.from(languages),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(new Date());
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <section className="hz-card p-5 space-y-4">
        <div
          className="text-xs hz-mono uppercase tracking-[.16em]"
          style={{ color: "var(--hz-ink-3)" }}
        >
          About
        </div>

        <UploadRow
          kind="photo"
          label="Photo"
          hint="JPG, PNG, or WEBP · max 5 MB"
          accept="image/jpeg,image/png,image/webp"
          existingUrl={initial.photoUrl}
          forUserId={forUserId}
        />

        <Field
          label="Name"
          htmlFor="name"
          hint="Shown across the app — to admin, to students in your batch, on attendance and exam records."
        >
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </Field>

        <Field
          label="Bio"
          htmlFor="bio"
          hint="A short paragraph students see when they're enrolled in your batch."
        >
          <Textarea
            id="bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={2000}
            placeholder="Tell students who you are and how you teach."
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Phone (WhatsApp)"
            htmlFor="phone"
            hint="Optional. Visible to admin; not surfaced to students."
          >
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+351 91 234 5678"
            />
          </Field>
          <div className="space-y-1.5">
            <Label>Languages</Label>
            <div className="flex flex-wrap gap-1.5">
              {(SUPPORTED_LOCALES as readonly TeacherLocale[]).map((l) => {
                const on = languages.has(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLanguage(l)}
                    className="chip"
                    style={{
                      cursor: "pointer",
                      background: on ? "var(--hz-primary-50)" : "transparent",
                      color: on ? "var(--hz-primary)" : "var(--hz-ink-2)",
                      border: `1px solid ${on ? "var(--hz-primary)" : "var(--hz-line)"}`,
                    }}
                  >
                    {LOCALE_LABEL[l]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Pick the languages you can teach in.
            </p>
          </div>
        </div>

        <UploadRow
          kind="cv"
          label="CV"
          hint="PDF · max 10 MB"
          accept="application/pdf"
          existingUrl={initial.cvUrl}
          forUserId={forUserId}
        />

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3 hair-t pt-3">
          {savedAt ? (
            <span
              className="hz-mono text-xs"
              style={{ color: "var(--hz-success)" }}
            >
              Saved {savedAt.toLocaleTimeString()}
            </span>
          ) : initial.updatedAt ? (
            <span
              className="hz-mono text-xs"
              style={{ color: "var(--hz-ink-3)" }}
            >
              Last saved {new Date(initial.updatedAt).toLocaleString()}
            </span>
          ) : null}
          <Button type="button" onClick={onSave} disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function UploadRow({
  kind,
  label,
  hint,
  accept,
  existingUrl,
  forUserId,
}: {
  kind: "photo" | "cv";
  label: string;
  hint: string;
  accept: string;
  existingUrl: string | null;
  forUserId?: string;
}) {
  const router = useRouter();
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (forUserId) fd.append("userId", forUserId);
    // Reset the input so re-uploading the same file fires a new change event.
    e.target.value = "";
    startUpload(async () => {
      const result = await uploadTeacherFileAction(kind, fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3 flex-wrap">
        {kind === "photo" && existingUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={existingUrl}
            alt="Current profile photo"
            className="rounded-md object-cover"
            style={{
              width: 72,
              height: 72,
              border: "1px solid var(--hz-line)",
              background: "var(--hz-surface-2)",
            }}
          />
        ) : null}
        {kind === "cv" && existingUrl ? (
          <a
            href={existingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-sm"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            View current CV
          </a>
        ) : null}

        <label className="btn-ghost text-sm cursor-pointer">
          {uploading
            ? "Uploading…"
            : existingUrl
              ? `Replace ${kind}`
              : `Upload ${kind}`}
          <input
            type="file"
            accept={accept}
            onChange={onChange}
            className="hidden"
            disabled={uploading}
          />
        </label>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
