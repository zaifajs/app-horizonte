"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSelection } from "./bulk-actions";
import { provisionStudentAuthBulk } from "@/lib/actions/student-auth";

export function SelectionRibbon({
  visibleCount,
  onSendWhatsApp,
}: {
  visibleCount: number;
  onSendWhatsApp: () => void;
}) {
  const { selected, clear } = useSelection();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | null
    | {
        tone: "success" | "warning" | "danger";
        text: string;
      }
  >(null);

  if (selected.size === 0) return null;

  function sendPortalInvites() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const confirmMsg =
      ids.length === 1
        ? "Send portal invite to 1 selected student?"
        : `Send portal invites to ${ids.length} selected students?`;
    if (!window.confirm(confirmMsg)) return;
    setStatus(null);
    startTransition(async () => {
      const result = await provisionStudentAuthBulk({ studentIds: ids });
      if (!result.ok) {
        setStatus({ tone: "danger", text: result.error });
        return;
      }
      const parts: string[] = [];
      if (result.invited > 0) parts.push(`${result.invited} invited`);
      if (result.alreadyLinked > 0) parts.push(`${result.alreadyLinked} already linked`);
      if (result.failed.length > 0) {
        // Surface the actual Supabase rejection reason so the user can see
        // *why* the invite failed (most common cause: undeliverable email
        // domains like @example.test). Show the first failure inline and
        // collapse the rest behind a count.
        const first = result.failed[0];
        const rest = result.failed.length > 1
          ? ` (+${result.failed.length - 1} more)`
          : "";
        parts.push(
          `failed for ${first.email}: ${first.reason}${rest}`,
        );
      }
      setStatus({
        tone: result.failed.length > 0 ? "warning" : "success",
        text: parts.length ? parts.join(" · ") : "Nothing to do.",
      });
      if (result.invited > 0) router.refresh();
    });
  }

  return (
    <div
      className="mb-3 px-3 sm:px-4 py-2.5 flex items-center gap-3 rounded-md flex-wrap"
      style={{
        background: "var(--hz-primary-50)",
        border: "1px solid var(--hz-primary)",
      }}
    >
      <span className="hz-cb indeterminate" style={{ display: "inline-flex" }} />
      <div className="leading-tight">
        <div className="hz-mono text-sm font-semibold" style={{ color: "var(--hz-ink)" }}>
          {selected.size} selected
        </div>
        <div className="hz-mono text-xs" style={{ color: "var(--hz-ink-2)" }}>
          of {visibleCount} visible
        </div>
      </div>

      {status ? (
        <div
          className="hz-mono text-xs"
          style={{
            color:
              status.tone === "success"
                ? "var(--hz-success)"
                : status.tone === "warning"
                  ? "var(--hz-warning)"
                  : "var(--hz-danger)",
          }}
          role="status"
        >
          {status.text}
        </div>
      ) : null}

      <div className="sm:ml-auto flex items-center gap-1.5 flex-wrap">
        {/* Bulk Record payment / Export / Withdraw are deferred — the
            disabled buttons that lived here were confusing affordances.
            Reintroduce them as enabled actions when the server actions exist. */}
        <button
          type="button"
          onClick={sendPortalInvites}
          disabled={pending}
          className="btn-ghost text-xs"
          style={{ padding: "5px 12px" }}
          title="Send a portal-access email to the selected students"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          {pending ? "Inviting…" : `Send portal invite (${selected.size})`}
        </button>
        <button
          type="button"
          onClick={onSendWhatsApp}
          className="btn-primary text-xs"
          style={{ padding: "5px 12px" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          Send WhatsApp ({selected.size})
        </button>
        <span style={{ width: 1, height: 18, background: "var(--hz-primary)", opacity: 0.3, marginLeft: 4 }} />
        <button
          type="button"
          onClick={clear}
          className="ibtn"
          style={{ background: "transparent", border: "none" }}
          aria-label="Clear selection"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
