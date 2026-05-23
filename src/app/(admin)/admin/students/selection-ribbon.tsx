"use client";

import { useSelection } from "./bulk-actions";

export function SelectionRibbon({
  visibleCount,
  onSendWhatsApp,
}: {
  visibleCount: number;
  onSendWhatsApp: () => void;
}) {
  const { selected, clear } = useSelection();
  if (selected.size === 0) return null;

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

      <div className="sm:ml-auto flex items-center gap-1.5 flex-wrap">
        {/* Bulk Record payment / Export / Withdraw are deferred — the
            disabled buttons that lived here were confusing affordances.
            Reintroduce them as enabled actions when the server actions exist. */}
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
