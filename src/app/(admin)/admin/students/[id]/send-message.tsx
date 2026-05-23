"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  TEMPLATE_META,
  buildWaMeLink,
  interpolate,
  renderEmailSubject,
  renderTemplate,
  TEMPLATES,
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

const LOCALES: { key: Locale; label: string }[] = [
  { key: "pt", label: "PT" },
  { key: "en", label: "EN" },
  { key: "bn", label: "BN" },
  { key: "ur", label: "UR" },
  { key: "hi", label: "HI" },
];

const TEMPLATE_DOTS: Record<TemplateKey, string> = {
  welcome: "var(--hz-info)",
  payment_reminder: "var(--hz-danger)",
  class_reminder: "var(--hz-warning)",
  cronograma: "var(--hz-primary)",
};

// Render an interpolated template body with the per-variable values
// highlighted as chip-style spans — same idea as MessageComposer's
// PreviewBody, kept local so this stays self-contained.
function PreviewBody({ body, vars }: { body: string; vars: TemplateVars }) {
  const replacements: { value: string; name: string }[] = [];
  for (const [name, val] of Object.entries(vars)) {
    if (val == null || String(val).length === 0) continue;
    replacements.push({ value: String(val), name });
  }
  const out: React.ReactNode[] = [];
  let rest = body;
  let i = 0;
  while (rest.length > 0) {
    let bestIdx = -1;
    let bestRep: { value: string; name: string } | null = null;
    for (const r of replacements) {
      const k = rest.indexOf(r.value);
      if (k !== -1 && (bestIdx === -1 || k < bestIdx)) {
        bestIdx = k;
        bestRep = r;
      }
    }
    if (bestRep && bestIdx >= 0) {
      if (bestIdx > 0) out.push(rest.slice(0, bestIdx));
      out.push(
        <span
          key={i++}
          className="px-1.5 py-0.5 rounded hz-mono"
          style={{
            background: "var(--hz-primary-50)",
            color: "var(--hz-primary)",
            fontSize: "0.92em",
            border: "1px solid var(--hz-line)",
          }}
          title={`{{${bestRep.name}}}`}
        >
          {bestRep.value}
        </span>,
      );
      rest = rest.slice(bestIdx + bestRep.value.length);
    } else {
      out.push(rest);
      break;
    }
  }
  return <>{out}</>;
}

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
  const [waOn, setWaOn] = useState(true);
  const [emailOn, setEmailOn] = useState(Boolean(studentEmail));
  const [sendResult, setSendResult] = useState<
    | { ok: number; failed: number; channels: ("WA_ME" | "EMAIL")[] }
    | null
  >(null);
  const [edited, setEdited] = useState<string | null>(null);

  const rawBody = useMemo(() => {
    return TEMPLATES[templateKey][chosenLocale] ?? TEMPLATES[templateKey].en;
  }, [templateKey, chosenLocale]);
  const renderedBody = useMemo(
    () => renderTemplate(templateKey, chosenLocale, vars),
    [templateKey, chosenLocale, vars],
  );
  const body = edited ?? renderedBody;
  const emailSubject = useMemo(
    () => renderEmailSubject(templateKey, chosenLocale, vars),
    [templateKey, chosenLocale, vars],
  );

  function send() {
    if (!waOn && !emailOn) return;
    setSendResult(null);
    startTransition(async () => {
      let ok = 0;
      let failed = 0;
      const channels: ("WA_ME" | "EMAIL")[] = [];
      try {
        if (waOn) {
          const link = buildWaMeLink(studentPhone, body);
          window.open(link, "_blank", "noopener,noreferrer");
          await logMessageSentAction({
            studentId,
            templateKey,
            body,
            channel: "WA_ME",
          });
          channels.push("WA_ME");
          ok += 1;
        }
        if (emailOn && studentEmail) {
          const res = await sendEmailToStudentAction({
            studentId,
            templateKey,
            bodyOverride: body,
            subjectOverride: emailSubject,
            vars,
          });
          if (!res.ok) throw new Error(res.error);
          channels.push("EMAIL");
          ok += 1;
        }
      } catch {
        failed += 1;
      }
      setSendResult({ ok, failed, channels });
      router.refresh();
    });
  }

  const channelLabel = (() => {
    const parts: string[] = [];
    if (waOn) parts.push("WhatsApp");
    if (emailOn && studentEmail) parts.push("email");
    return parts.length > 0 ? `opens ${parts.join(" + ")}` : "Nothing selected";
  })();

  return (
    <div className="space-y-4">
      {/* Recipient header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="status-pill" style={{ color: "var(--hz-success)" }}>
          <span
            className="dot"
            style={{ background: "var(--hz-success)", boxShadow: "0 0 6px var(--hz-success)" }}
          />
          Send to {studentName}
        </span>
        <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
          {studentPhone} · locale {chosenLocale.toUpperCase()} ({nationalityLabel})
        </span>
      </div>

      {/* Template */}
      <div>
        <div className="text-xs hz-mono uppercase tracking-[.16em] mb-2" style={{ color: "var(--hz-ink-3)" }}>
          Template
        </div>
        <div className="relative">
          <select
            value={templateKey}
            onChange={(e) => {
              setTemplateKey(e.target.value as TemplateKey);
              setEdited(null);
            }}
            className="w-full appearance-none btn-ghost text-left"
            style={{ paddingLeft: 12, paddingRight: 30, height: 36, fontSize: "0.875rem" }}
          >
            {(Object.keys(TEMPLATE_META) as TemplateKey[]).map((k) => (
              <option key={k} value={k}>
                {TEMPLATE_META[k].label}
              </option>
            ))}
          </select>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--hz-ink-3)",
            }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs hz-mono" style={{ color: "var(--hz-ink-3)" }}>
          <span className="dot" style={{ background: TEMPLATE_DOTS[templateKey] }} />
          {TEMPLATE_META[templateKey].hint}
        </div>
      </div>

      {/* Language tabs */}
      <div>
        <div className="seg" style={{ width: "100%" }}>
          {LOCALES.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => {
                setChosenLocale(l.key);
                setEdited(null);
              }}
              className={`flex-1 ${chosenLocale === l.key ? "on" : ""}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        <div
          className="flex items-baseline justify-between mb-2 text-xs hz-mono"
          style={{ color: "var(--hz-ink-3)" }}
        >
          <span className="uppercase tracking-[.16em]">
            Preview · {chosenLocale.toUpperCase()}
          </span>
          {edited != null ? (
            <button
              type="button"
              onClick={() => setEdited(null)}
              className="underline hover:text-[var(--hz-ink-2)]"
            >
              Reset to template
            </button>
          ) : null}
        </div>
        {edited != null ? (
          <textarea
            value={body}
            onChange={(e) => setEdited(e.target.value)}
            rows={6}
            className="inp"
            style={{
              width: "100%",
              height: "auto",
              padding: "10px 12px",
              fontFamily: "var(--font-sans)",
              lineHeight: 1.5,
              resize: "vertical",
              display: "block",
            }}
          />
        ) : (
          <div
            className="p-3 rounded-md text-sm leading-relaxed whitespace-pre-wrap cursor-text"
            style={{ background: "var(--hz-surface-2)", border: "1px solid var(--hz-line)" }}
            onClick={() => setEdited(renderedBody)}
            title="Click to edit"
          >
            <PreviewBody body={interpolate(rawBody, vars)} vars={vars} />
          </div>
        )}
        {templateKey === "cronograma" && !vars.scheduleUrl ? (
          <p className="mt-1 hz-mono text-xs" style={{ color: "var(--hz-warning)" }}>
            No batch enrolment found — the schedule link will be empty. Enrol the student first.
          </p>
        ) : null}
      </div>

      {/* Send via */}
      <div>
        <div className="text-xs hz-mono uppercase tracking-[.16em] mb-2" style={{ color: "var(--hz-ink-3)" }}>
          Send via
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label
            className="flex items-center gap-2 p-2 px-3 rounded-md flex-1 cursor-pointer"
            style={{
              background: waOn ? "var(--hz-primary-50)" : "var(--hz-surface-2)",
              border: `1px solid ${waOn ? "var(--hz-primary)" : "var(--hz-line)"}`,
              minWidth: 140,
            }}
          >
            <input
              type="checkbox"
              className="hz-cb"
              checked={waOn}
              onChange={(e) => setWaOn(e.target.checked)}
            />
            <span className="text-sm font-semibold">WhatsApp</span>
          </label>
          <label
            className={`flex items-center gap-2 p-2 px-3 rounded-md flex-1 ${studentEmail ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
            style={{
              background: emailOn ? "var(--hz-primary-50)" : "var(--hz-surface-2)",
              border: `1px solid ${emailOn ? "var(--hz-primary)" : "var(--hz-line)"}`,
              minWidth: 140,
            }}
            title={studentEmail ? undefined : "No email on file"}
          >
            <input
              type="checkbox"
              className="hz-cb"
              checked={emailOn}
              disabled={!studentEmail}
              onChange={(e) => setEmailOn(e.target.checked)}
            />
            <span className="text-sm font-semibold">Email</span>
          </label>
        </div>
      </div>

      {/* Result banner */}
      {sendResult ? (
        <div
          className="px-3 py-2.5 rounded-md flex items-center gap-2"
          style={{
            background:
              sendResult.failed === 0
                ? "var(--hz-success-50)"
                : sendResult.ok === 0
                  ? "var(--hz-danger-50)"
                  : "var(--hz-warning-50)",
          }}
        >
          {sendResult.failed === 0 ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--hz-success)" }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--hz-danger)" }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <div className="flex-1">
            <div className="text-sm font-semibold">
              {sendResult.failed === 0
                ? `Sent via ${sendResult.channels.map((c) => (c === "WA_ME" ? "WhatsApp" : "email")).join(" + ")}`
                : "Failed to send"}
            </div>
            <div className="hz-mono text-xs" style={{ color: "var(--hz-ink-2)" }}>
              {sendResult.channels.includes("WA_ME")
                ? "Check the opened WhatsApp tab and press Send."
                : "Email queued via Resend."}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSendResult(null)}
            className="ibtn"
            style={{ width: 24, height: 24 }}
            aria-label="Dismiss"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      ) : null}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
          {channelLabel}
        </span>
        <button
          type="button"
          onClick={send}
          disabled={pending || (!waOn && !emailOn) || (!studentPhone && waOn)}
          className="btn-primary"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22 11 13 2 9z" />
          </svg>
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
