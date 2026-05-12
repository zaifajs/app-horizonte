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
  TEMPLATES,
  buildWaMeLink,
  renderTemplate,
  type TemplateKey,
  type TemplateVars,
} from "@/lib/messaging/templates";
import type { Locale } from "@/i18n/routing";
import { logMessageSentAction } from "@/lib/actions/messages";

type Props = {
  studentId: string;
  studentName: string;
  studentPhone: string;
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
  locale,
  vars,
  nationalityLabel,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [templateKey, setTemplateKey] = useState<TemplateKey>("welcome");
  const [chosenLocale, setChosenLocale] = useState<Locale>(locale);
  const [edited, setEdited] = useState<string | null>(null);

  const rendered = useMemo(
    () => renderTemplate(templateKey, chosenLocale, vars),
    [templateKey, chosenLocale, vars],
  );
  const body = edited ?? rendered;

  const waMe = useMemo(
    () => buildWaMeLink(studentPhone, body),
    [studentPhone, body],
  );

  function reset() {
    setEdited(null);
  }

  function onSend() {
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

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3 text-sm">
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
        <p className="text-xs text-amber-700">
          No batch enrolment found — the schedule link will be empty. Enrol the
          student first.
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <a
          href={waMe}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onSend}
        >
          <Button disabled={pending || !studentPhone}>
            Open WhatsApp & log
          </Button>
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Clicking "Open WhatsApp" launches your chat window with the message pre-filled
        and logs this attempt to the activity stream. You still need to press Send in WhatsApp.
      </p>
    </div>
  );
}
