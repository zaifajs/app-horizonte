"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TEMPLATE_META,
  buildWaMeLink,
  renderEmailSubject,
  renderTemplate,
  type TemplateKey,
  type TemplateVars,
} from "@/lib/messaging/templates";
import type { Locale } from "@/i18n/routing";
import {
  logMessageSentAction,
  sendEmailToStudentAction,
} from "@/lib/actions/messages";

type Props = {
  studentId: string;
  studentName: string;
  studentPhone: string;
  studentEmail: string;
  locale: Locale;
  vars: TemplateVars;
  /** Computed server-side from nationality; can be overridden in the picker. */
  nationalityLabel: string;
};

const LOCALES: Array<{ key: Locale; label: string }> = [
  { key: "en", label: "English" },
  { key: "pt", label: "Português" },
  { key: "bn", label: "বাংলা" },
  { key: "ur", label: "اردو" },
  { key: "hi", label: "हिन्दी" },
];

export function SendMessage({
  studentId,
  studentName,
  studentPhone,
  studentEmail,
  locale,
  vars,
  nationalityLabel,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [templateKey, setTemplateKey] = useState<TemplateKey>("welcome");
  const [chosenLocale, setChosenLocale] = useState<Locale>(locale);
  const [edited, setEdited] = useState<string | null>(null);
  const [emailFeedback, setEmailFeedback] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  const rendered = useMemo(
    () => renderTemplate(templateKey, chosenLocale, vars),
    [templateKey, chosenLocale, vars],
  );
  const body = edited ?? rendered;
  const emailSubject = useMemo(
    () => renderEmailSubject(templateKey, chosenLocale, vars),
    [templateKey, chosenLocale, vars],
  );

  const waMe = useMemo(
    () => buildWaMeLink(studentPhone, body),
    [studentPhone, body],
  );

  function reset() {
    setEdited(null);
  }

  function onSendWa() {
    startTransition(async () => {
      await logMessageSentAction({
        studentId,
        templateKey,
        body,
        channel: "WA_ME",
      });
      router.refresh();
    });
  }

  function onSendEmail() {
    setEmailFeedback(null);
    startTransition(async () => {
      const result = await sendEmailToStudentAction({
        studentId,
        templateKey,
        bodyOverride: body,
        subjectOverride: emailSubject,
        vars,
      });
      if (!result.ok) {
        setEmailFeedback({ kind: "err", text: result.error });
        return;
      }
      setEmailFeedback({ kind: "ok", text: "Email sent." });
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="font-medium">Send WhatsApp to {studentName}</div>
          <div className="text-xs text-muted-foreground">
            {studentPhone} · derived locale: {chosenLocale}{" "}
            <span className="text-zinc-400">({nationalityLabel})</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tpl">Template</Label>
          <Select value={templateKey} onValueChange={(v) => v && (setTemplateKey(v as TemplateKey), setEdited(null))}>
            <SelectTrigger id="tpl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TEMPLATE_META) as TemplateKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {TEMPLATE_META[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {TEMPLATE_META[templateKey].hint}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc">Language</Label>
          <Select value={chosenLocale} onValueChange={(v) => v && (setChosenLocale(v as Locale), setEdited(null))}>
            <SelectTrigger id="loc">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l.key} value={l.key}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="msg">Message preview (editable)</Label>
        <Textarea
          id="msg"
          rows={5}
          value={body}
          onChange={(e) => setEdited(e.target.value)}
        />
        {edited != null ? (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Reset to template
          </button>
        ) : null}
      </div>

      {templateKey === "cronograma" && !vars.scheduleUrl ? (
        <p className="text-xs text-[var(--hz-warning)]">
          No batch enrolment found — the schedule link will be empty. Enrol the
          student first.
        </p>
      ) : null}

      <div className="rounded-md border bg-muted px-3 py-2 text-xs">
        <div className="text-muted-foreground uppercase tracking-wide">
          Email subject preview
        </div>
        <div className="mt-0.5 font-medium">{emailSubject}</div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          variant="outline"
          disabled={pending || !studentEmail}
          onClick={onSendEmail}
        >
          {pending ? "Sending…" : "Send email"}
        </Button>
        <a
          href={waMe}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onSendWa}
        >
          <Button disabled={pending || !studentPhone}>
            Open WhatsApp & log
          </Button>
        </a>
      </div>
      {emailFeedback ? (
        <p
          className={
            emailFeedback.kind === "ok"
              ? "text-xs text-[var(--hz-success)]"
              : "text-xs text-destructive"
          }
        >
          {emailFeedback.text}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        WhatsApp opens your chat window with the message pre-filled — you still
        press Send. Email goes out immediately via Resend.
      </p>
    </div>
  );
}
