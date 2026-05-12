"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  renderTemplate,
  type TemplateKey,
  type TemplateVars,
} from "@/lib/messaging/templates";
import type { Locale } from "@/i18n/routing";
import {
  logMessageSentAction,
  sendEmailToStudentAction,
} from "@/lib/actions/messages";

export type BulkRow = {
  studentId: string;
  fullName: string;
  phone: string;
  email: string;
  locale: Locale;
  vars: TemplateVars;
};

type Channel = "WA_ME" | "EMAIL";

export function BulkWhatsAppQueue({
  open,
  onOpenChange,
  rows,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  rows: BulkRow[];
}) {
  const router = useRouter();
  const [templateKey, setTemplateKey] = useState<TemplateKey>("payment_reminder");
  const [channel, setChannel] = useState<Channel>("WA_ME");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [pending, startTransition] = useTransition();
  const [bulkPending, setBulkPending] = useState(false);

  const sendable = useMemo(
    () =>
      rows.map((r) => {
        const body = renderTemplate(templateKey, r.locale, r.vars);
        const waMeUrl = buildWaMeLink(r.phone, body);
        return { ...r, body, waMeUrl };
      }),
    [rows, templateKey],
  );

  function markSent(studentId: string, body: string) {
    setSent((prev) => new Set(prev).add(studentId));
    startTransition(async () => {
      await logMessageSentAction({
        studentId,
        templateKey,
        body,
        channel: "WA_ME",
      });
    });
  }

  async function sendEmailTo(row: BulkRow & { body: string }) {
    if (sent.has(row.studentId)) return;
    const result = await sendEmailToStudentAction({
      studentId: row.studentId,
      templateKey,
      bodyOverride: row.body,
      vars: row.vars,
    });
    if (result.ok) {
      setSent((prev) => new Set(prev).add(row.studentId));
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(row.studentId);
        return next;
      });
    } else {
      setErrors((prev) => new Map(prev).set(row.studentId, result.error));
    }
  }

  function sendAllEmails() {
    setBulkPending(true);
    startTransition(async () => {
      for (const r of sendable) {
        if (sent.has(r.studentId)) continue;
        // sequential — Resend free tier rate-limits short bursts
        // (~2 req/sec). Sequential keeps us safely under that.
        // eslint-disable-next-line no-await-in-loop
        await sendEmailTo(r);
      }
      setBulkPending(false);
    });
  }

  function reset() {
    setSent(new Set());
    setErrors(new Map());
  }

  function close() {
    onOpenChange(false);
    router.refresh();
    setTimeout(reset, 300);
  }

  const sentCount = sent.size;
  const total = rows.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!w-full sm:!max-w-none md:!w-1/2 lg:!w-2/5 overflow-y-auto p-6"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Send WhatsApp to {total} students</SheetTitle>
          <SheetDescription>Click each link to open WhatsApp.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <header>
            <h2 className="text-lg font-semibold tracking-tight">
              Send {channel === "WA_ME" ? "WhatsApp" : "email"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {sentCount} of {total} sent ·{" "}
              {channel === "WA_ME"
                ? "click each line to open WhatsApp with the message pre-filled."
                : "press \"Send all\" to email everyone in one go."}
            </p>
          </header>

          <div className="inline-flex rounded-lg border bg-white p-0.5">
            {(["WA_ME", "EMAIL"] as Channel[]).map((c) => {
              const active = channel === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setChannel(c);
                    reset();
                  }}
                  className={`text-sm px-3 py-1.5 rounded-md transition ${
                    active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {c === "WA_ME" ? "WhatsApp" : "Email"}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-tpl">Template</Label>
            <Select value={templateKey} onValueChange={(v) => v && (setTemplateKey(v as TemplateKey), reset())}>
              <SelectTrigger id="bulk-tpl">
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
              {TEMPLATE_META[templateKey].hint} · Language picked per student
              from their nationality.
            </p>
          </div>

          {channel === "WA_ME" ? (
            <div className="rounded-lg border bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
              wa.me only opens one chat at a time — go through the list,
              clicking each line. Each click is logged to the activity stream.
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border bg-zinc-50 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Sends sequentially via Resend.
                {" "}
                {rows.filter((r) => !r.email).length > 0
                  ? `${rows.filter((r) => !r.email).length} have no email and will be skipped.`
                  : null}
              </span>
              <Button
                size="sm"
                onClick={sendAllEmails}
                disabled={bulkPending || sentCount === total}
              >
                {bulkPending ? `Sending ${sentCount + 1}/${total}…` : "Send all"}
              </Button>
            </div>
          )}

          <ul className="space-y-2">
            {sendable.map((r, i) => {
              const isSent = sent.has(r.studentId);
              return (
                <li
                  key={r.studentId}
                  className={`rounded-lg border bg-white p-3 transition-colors ${
                    isSent ? "border-emerald-300 bg-emerald-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {i + 1}.
                        </span>
                        <span className="font-medium truncate">
                          {r.fullName}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {channel === "EMAIL" ? r.email || "no email" : r.phone}
                          {" · "}
                          {r.locale}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {r.body}
                      </p>
                      {errors.get(r.studentId) ? (
                        <p className="text-xs text-destructive mt-0.5">
                          {errors.get(r.studentId)}
                        </p>
                      ) : null}
                    </div>
                    {isSent ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-900 px-2 py-1 text-xs font-medium">
                        <Check className="h-3 w-3" />
                        Sent
                      </span>
                    ) : channel === "WA_ME" ? (
                      <a
                        href={r.waMeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markSent(r.studentId, r.body)}
                      >
                        <Button size="sm" variant="outline">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Open
                        </Button>
                      </a>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!r.email || pending || bulkPending}
                        onClick={() => sendEmailTo(r)}
                      >
                        Send
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {pending ? "Logging…" : null}
            </p>
            <Button onClick={close}>
              {sentCount === total ? "Done" : "Close"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
