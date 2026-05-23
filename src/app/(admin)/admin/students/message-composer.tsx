"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buildWaMeLink,
  interpolate,
  type TemplateKey,
  type TemplateVars,
} from "@/lib/messaging/templates";
import type { ResolvedTemplate } from "@/lib/messaging/template-store";
import {
  logMessageSentAction,
  sendEmailToStudentAction,
} from "@/lib/actions/messages";
import type { Locale } from "@/i18n/routing";
import type { BulkRow } from "./bulk-whatsapp-queue";
import { Avatar } from "@/components/ui/avatar";

const LOCALES: { key: Locale; label: string }[] = [
  { key: "pt", label: "PT" },
  { key: "en", label: "EN" },
  { key: "bn", label: "BN" },
  { key: "ur", label: "UR" },
  { key: "hi", label: "HI" },
];

const TEMPLATE_DOTS: Record<string, string> = {
  welcome: "var(--hz-info)",
  payment_reminder: "var(--hz-danger)",
  class_reminder: "var(--hz-warning)",
  cronograma: "var(--hz-primary)",
};

const CUSTOM_DOT = "var(--hz-accent)";

type RowState = "idle" | "sending" | "sent" | "error";

function majorityLocale(rows: BulkRow[]): Locale {
  const counts = new Map<Locale, number>();
  for (const r of rows) counts.set(r.locale, (counts.get(r.locale) ?? 0) + 1);
  let best: Locale = "pt";
  let bestN = 0;
  for (const [loc, n] of counts) {
    if (n > bestN) {
      best = loc;
      bestN = n;
    }
  }
  return best;
}

// Render the rendered-template body with {{var}} segments highlighted as chips.
function PreviewBody({
  body,
  vars,
}: {
  body: string;
  vars: TemplateVars;
}) {
  // The body has already been interpolated, so we instead detect the values
  // and visually mark them. Build a list of (value, varName) replacements.
  const replacements: { value: string; name: string }[] = [];
  for (const [name, val] of Object.entries(vars)) {
    if (val == null || String(val).length === 0) continue;
    replacements.push({ value: String(val), name });
  }
  // Greedy split: walk the body, take the first occurrence of any replacement.
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

export function MessageComposer({
  open,
  onClose,
  recipients,
  onRemoveRecipient,
  templates,
}: {
  open: boolean;
  onClose: () => void;
  recipients: BulkRow[];
  onRemoveRecipient: (studentId: string) => void;
  templates: ResolvedTemplate[];
}) {
  const router = useRouter();
  // Default to payment_reminder if available, else first system template.
  const defaultTemplateId =
    templates.find((t) => t.key === "payment_reminder")?.id ??
    templates.find((t) => t.isSystem)?.id ??
    templates[0]?.id ??
    "";
  const [templateId, setTemplateId] = useState<string>(defaultTemplateId);
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? templates[0],
    [templates, templateId],
  );
  const [locale, setLocale] = useState<Locale>("pt");
  const [waOn, setWaOn] = useState(true);
  const [emailOn, setEmailOn] = useState(false);
  const [rowState, setRowState] = useState<Map<string, RowState>>(new Map());
  const [sendResult, setSendResult] = useState<
    | { ok: number; failed: number; channels: ("WA_ME" | "EMAIL")[] }
    | null
  >(null);
  const [pending, startTransition] = useTransition();

  // Reset state when panel opens with a fresh recipient set.
  useEffect(() => {
    if (!open) return;
    setRowState(new Map());
    setSendResult(null);
    setLocale(majorityLocale(recipients));
  }, [open, recipients]);

  // Auto-close when last recipient removed.
  useEffect(() => {
    if (open && recipients.length === 0) onClose();
  }, [open, recipients.length, onClose]);

  // ESC closes the panel.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const previewRecipient = recipients[0];
  const previewBody = useMemo(() => {
    if (!previewRecipient || !selectedTemplate) return "";
    const raw =
      selectedTemplate.bodies[locale] || selectedTemplate.bodies.en || "";
    return interpolate(raw, previewRecipient.vars);
  }, [selectedTemplate, locale, previewRecipient]);

  const channelLabel = (() => {
    const parts: string[] = [];
    if (waOn) parts.push(`${recipients.length} WhatsApp tab${recipients.length === 1 ? "" : "s"}`);
    if (emailOn) parts.push(`${recipients.length} email${recipients.length === 1 ? "" : "s"}`);
    return parts.length > 0 ? `opens ${parts.join(" + ")}` : "Nothing selected";
  })();

  function send() {
    if (recipients.length === 0) return;
    if (!waOn && !emailOn) return;
    setSendResult(null);
    startTransition(async () => {
      const next = new Map<string, RowState>();
      for (const r of recipients) next.set(r.studentId, "sending");
      setRowState(next);

      let okCount = 0;
      let failCount = 0;
      const channels: ("WA_ME" | "EMAIL")[] = [];
      if (waOn) channels.push("WA_ME");
      if (emailOn) channels.push("EMAIL");

      for (const r of recipients) {
        if (!selectedTemplate) {
          failCount += 1;
          continue;
        }
        const perLocale = r.locale ?? locale;
        const rawBody =
          selectedTemplate.bodies[perLocale] ||
          selectedTemplate.bodies.en ||
          "";
        const rawSubject =
          selectedTemplate.subjects[perLocale] ||
          selectedTemplate.subjects.en ||
          "";
        const body = interpolate(rawBody, r.vars);
        const subject = interpolate(rawSubject, r.vars);
        // For the message log, system templates use their stable key;
        // custom templates use their UUID so we can trace back to the row.
        const logKey: TemplateKey | string =
          selectedTemplate.key ?? selectedTemplate.id;
        try {
          if (waOn) {
            const link = buildWaMeLink(r.phone, body);
            window.open(link, "_blank", "noopener,noreferrer");
            await logMessageSentAction({
              studentId: r.studentId,
              templateKey: logKey as TemplateKey,
              body,
              channel: "WA_ME",
            });
          }
          if (emailOn) {
            const res = await sendEmailToStudentAction({
              studentId: r.studentId,
              templateKey: (selectedTemplate.key ?? "welcome") as TemplateKey,
              bodyOverride: body,
              subjectOverride: subject,
              vars: r.vars,
            });
            if (!res.ok) throw new Error(res.error);
          }
          setRowState((prev) => {
            const m = new Map(prev);
            m.set(r.studentId, "sent");
            return m;
          });
          okCount += 1;
        } catch {
          setRowState((prev) => {
            const m = new Map(prev);
            m.set(r.studentId, "error");
            return m;
          });
          failCount += 1;
        }
      }

      setSendResult({ ok: okCount, failed: failCount, channels });
      router.refresh();
    });
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop — click anywhere outside the panel closes it */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(11,14,20,0.45)",
          backdropFilter: "blur(2px)",
          zIndex: 39,
        }}
      />
      <aside
        className="hair-l flex flex-col print:hidden w-full sm:w-[520px]"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          background: "var(--hz-surface)",
          zIndex: 40,
          boxShadow: "-16px 0 40px -16px rgba(0,0,0,0.6)",
          textAlign: "left",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
      {/* Header */}
      <header className="hair-b px-4 py-3 flex items-center gap-2">
        <span className="status-pill" style={{ color: "var(--hz-success)" }}>
          <span
            className="dot"
            style={{ background: "var(--hz-success)", boxShadow: "0 0 6px var(--hz-success)" }}
          />
          Send message
        </span>
        <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
          {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
        </span>
        <button type="button" onClick={onClose} className="ibtn ml-auto" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Recipients */}
        <section className="px-4 py-4">
          <div className="text-xs hz-mono uppercase tracking-[.16em] mb-2" style={{ color: "var(--hz-ink-3)" }}>
            Recipients
          </div>
          <ul className="space-y-1.5">
            {recipients.map((r) => {
              const state = rowState.get(r.studentId) ?? "idle";
              return (
                <li
                  key={r.studentId}
                  className="flex items-center gap-2.5 rounded-md p-2"
                  style={{ background: "var(--hz-surface-2)", border: "1px solid var(--hz-line)" }}
                >
                  <Avatar name={r.fullName} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{r.fullName}</div>
                    <div className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
                      {r.phone}
                      {r.vars.dueAmount ? ` · ${r.vars.dueAmount}` : null}
                    </div>
                  </div>
                  {state === "sent" ? (
                    <span style={{ color: "var(--hz-success)" }} title="Sent">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  ) : state === "sending" ? (
                    <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>…</span>
                  ) : state === "error" ? (
                    <span style={{ color: "var(--hz-danger)" }} title="Failed">!</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRemoveRecipient(r.studentId)}
                      className="ibtn"
                      style={{ width: 22, height: 22 }}
                      aria-label="Remove"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Template */}
        <section className="px-4 pb-4">
          <div className="text-xs hz-mono uppercase tracking-[.16em] mb-2" style={{ color: "var(--hz-ink-3)" }}>
            Template
          </div>
          <div className="relative">
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full appearance-none btn-ghost text-left"
              style={{ paddingLeft: 12, paddingRight: 30, height: 36, fontSize: "0.875rem" }}
            >
              <optgroup label="System">
                {templates.filter((t) => t.isSystem).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
              {templates.some((t) => !t.isSystem) ? (
                <optgroup label="Custom">
                  {templates.filter((t) => !t.isSystem).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--hz-ink-3)" }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs hz-mono" style={{ color: "var(--hz-ink-3)" }}>
            <span
              className="dot"
              style={{
                background: selectedTemplate?.key
                  ? TEMPLATE_DOTS[selectedTemplate.key] ?? CUSTOM_DOT
                  : CUSTOM_DOT,
              }}
            />
            {selectedTemplate?.hint ?? (selectedTemplate?.isSystem ? "" : "Custom template")}
          </div>
        </section>

        {/* Language tabs */}
        <section className="px-4 pb-4">
          <div className="seg" style={{ width: "100%" }}>
            {LOCALES.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLocale(l.key)}
                className={`flex-1 ${locale === l.key ? "on" : ""}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </section>

        {/* Preview */}
        {previewRecipient ? (
          <section className="px-4 pb-4">
            <div
              className="flex items-baseline justify-between mb-2 text-xs hz-mono"
              style={{ color: "var(--hz-ink-3)" }}
            >
              <span className="uppercase tracking-[.16em]">
                Preview · {locale.toUpperCase()}-PT
              </span>
              <span>vars · {Object.keys(previewRecipient.vars).filter((k) => previewRecipient.vars[k as keyof TemplateVars]).length}</span>
            </div>
            <div
              className="p-3 rounded-md text-sm leading-relaxed"
              style={{ background: "var(--hz-surface-2)", border: "1px solid var(--hz-line)" }}
            >
              <PreviewBody body={previewBody} vars={previewRecipient.vars} />
            </div>
            <a
              href="/admin/messages/templates"
              className="mt-2 inline-block text-xs underline"
              style={{ color: "var(--hz-ink-2)" }}
            >
              Edit template
            </a>
          </section>
        ) : null}

        {/* Send via */}
        <section className="px-4 pb-4">
          <div className="text-xs hz-mono uppercase tracking-[.16em] mb-2" style={{ color: "var(--hz-ink-3)" }}>
            Send via
          </div>
          <div className="flex items-center gap-2">
            <label
              className="flex items-center gap-2 p-2 px-3 rounded-md flex-1 cursor-pointer"
              style={{
                background: waOn ? "var(--hz-primary-50)" : "var(--hz-surface-2)",
                border: `1px solid ${waOn ? "var(--hz-primary)" : "var(--hz-line)"}`,
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
              className="flex items-center gap-2 p-2 px-3 rounded-md flex-1 cursor-pointer"
              style={{
                background: emailOn ? "var(--hz-primary-50)" : "var(--hz-surface-2)",
                border: `1px solid ${emailOn ? "var(--hz-primary)" : "var(--hz-line)"}`,
              }}
            >
              <input
                type="checkbox"
                className="hz-cb"
                checked={emailOn}
                onChange={(e) => setEmailOn(e.target.checked)}
              />
              <span className="text-sm font-semibold">Email cc</span>
            </label>
          </div>
        </section>
      </div>

      {/* Result banner */}
      {sendResult ? (
        <div
          className="hair-t px-4 py-2.5 flex items-center gap-2"
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
          ) : sendResult.ok === 0 ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--hz-danger)" }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--hz-warning)" }}>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: "var(--hz-ink)" }}>
              {sendResult.failed === 0
                ? `Sent to ${sendResult.ok} ${sendResult.ok === 1 ? "recipient" : "recipients"}`
                : sendResult.ok === 0
                  ? `Failed to send to all ${sendResult.failed} ${sendResult.failed === 1 ? "recipient" : "recipients"}`
                  : `Sent ${sendResult.ok} · failed ${sendResult.failed}`}
            </div>
            <div className="hz-mono text-xs" style={{ color: "var(--hz-ink-2)" }}>
              via {sendResult.channels.map((c) => (c === "WA_ME" ? "WhatsApp" : "email")).join(" + ")}
              {sendResult.channels.includes("WA_ME") ? " · check the opened tabs and press Send in each" : null}
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
      <footer className="hair-t px-4 py-3 flex items-center justify-between gap-3">
        <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
          {channelLabel}
        </span>
        <button
          type="button"
          onClick={send}
          disabled={pending || recipients.length === 0 || (!waOn && !emailOn)}
          className="btn-primary"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22 11 13 2 9z" />
          </svg>
          {pending ? "Sending…" : `Send to ${recipients.length}`}
        </button>
      </footer>
      </aside>
    </>
  );
}
