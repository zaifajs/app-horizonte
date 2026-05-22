"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPaymentAction } from "@/lib/actions/payments";

type Method = "BANK" | "CASH";

export function QuickPay({
  enrollmentId,
  studentName,
  remainingCents,
  feeCents,
  paidCents,
  studentEmail,
  batchCode,
  urgencyTone,
}: {
  enrollmentId: string;
  studentName: string;
  remainingCents: number;
  feeCents: number;
  paidCents: number;
  studentEmail?: string;
  batchCode?: string;
  urgencyTone?: "danger" | "warning" | "due" | "neutral";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState((remainingCents / 100).toFixed(2));
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<Method>("BANK");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Reset when opening so the modal reflects current state if the user
  // opened it on a different row earlier in the session.
  useEffect(() => {
    if (open) {
      setAmount((remainingCents / 100).toFixed(2));
      setPaidAt(today);
      setMethod("BANK");
      setReference("");
      setNotes("");
      setError(null);
    }
  }, [open, remainingCents, today]);

  // ESC + ⌘↵ shortcuts
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        save();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, amount, paidAt, method, reference, notes]);

  function save() {
    setError(null);
    const combinedNotes = [reference.trim(), notes.trim()]
      .filter(Boolean)
      .join(" · ");
    startTransition(async () => {
      const result = await addPaymentAction({
        enrollmentId,
        amount,
        method,
        paidAt,
        notes: combinedNotes || null,
        proof: null,
        isVerified: false,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const feeEur = feeCents / 100;
  const paidEur = paidCents / 100;
  const amtNum = Number.parseFloat(amount) || 0;
  const nextPaid = paidEur + amtNum;
  const nextOutstanding = Math.max(0, feeEur - nextPaid);
  const isFullyPaidAfter = nextOutstanding <= 0.005;

  const aviStyle = (() => {
    const map: Record<string, { c: string; bg: string; border: string }> = {
      danger: {
        c: "var(--hz-danger)",
        bg: "var(--hz-danger-50)",
        border: "rgba(248,113,113,0.25)",
      },
      warning: {
        c: "var(--hz-warning)",
        bg: "var(--hz-warning-50)",
        border: "rgba(244,181,63,0.25)",
      },
      due: {
        c: "var(--hz-accent)",
        bg: "var(--hz-accent-50)",
        border: "rgba(255,122,69,0.25)",
      },
      neutral: { c: "var(--hz-ink)", bg: "var(--hz-surface-2)", border: "var(--hz-line)" },
    };
    return map[urgencyTone ?? "neutral"];
  })();

  const initials =
    studentName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "??";

  // Quick-amount presets
  const presets: { value: number; label: string }[] = [];
  if (remainingCents > 0) {
    presets.push({
      value: remainingCents / 100,
      label: `€${(remainingCents / 100).toFixed(0)} · remaining`,
    });
  }
  if (feeCents > 0 && remainingCents !== feeCents) {
    presets.push({
      value: feeCents / 100,
      label: `€${(feeCents / 100).toFixed(0)} · full`,
    });
  }
  if (feeCents / 2 !== remainingCents / 100 && feeCents > 0) {
    presets.push({
      value: feeCents / 200,
      label: `€${(feeCents / 200).toFixed(0)} · half`,
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="ibtn"
        title="Record payment"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11,14,20,0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              maxWidth: "100%",
              background: "var(--hz-surface)",
              border: "1px solid var(--hz-line)",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 24px 60px -16px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header */}
            <header className="px-5 py-4 hair-b flex items-center gap-3">
              <span
                className="avi"
                style={{
                  width: 40,
                  height: 40,
                  fontSize: 14,
                  color: aviStyle.c,
                  background: aviStyle.bg,
                  borderColor: aviStyle.border,
                }}
              >
                {initials}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[12px] hz-mono uppercase tracking-[.16em]"
                  style={{ color: "var(--hz-ink-3)" }}
                >
                  Record payment
                </div>
                <div className="mt-0.5 font-display text-[20px] font-medium truncate">
                  {studentName}
                </div>
                <div
                  className="text-[13px] hz-mono mt-0.5"
                  style={{ color: "var(--hz-ink-3)" }}
                >
                  {batchCode ? (
                    <>
                      Batch <span style={{ color: "var(--hz-primary)" }}>{batchCode}</span> ·{" "}
                    </>
                  ) : null}
                  Outstanding{" "}
                  <span style={{ color: "var(--hz-ink)" }}>
                    €{(remainingCents / 100).toFixed(0)} of €{feeEur.toFixed(0)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ibtn"
                style={{ border: "none", background: "transparent" }}
                title="Close (Esc)"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </header>

            <div className="px-5 py-5 flex flex-col gap-4">
              {/* Amount */}
              <div>
                <label className="field-label">
                  Amount <span className="req">*</span>
                </label>
                <label className="pay-amount">
                  <span className="cur">€</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                  />
                </label>
                {presets.length > 0 ? (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {presets.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setAmount(p.value.toFixed(2))}
                        className={`quick-amt ${
                          Math.abs(Number.parseFloat(amount) - p.value) < 0.005 ? "on" : ""
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Method */}
              <div>
                <label className="field-label">
                  Method <span className="req">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod("BANK")}
                    className={`pay-method ${method === "BANK" ? "on" : ""}`}
                  >
                    <span className="ind" />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3 21 18 0" />
                      <path d="M5 21V10l7-5 7 5v11" />
                      <path d="M9 21v-6h6v6" />
                    </svg>
                    Bank transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("CASH")}
                    className={`pay-method ${method === "CASH" ? "on" : ""}`}
                  >
                    <span className="ind" />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <circle cx="12" cy="12" r="2" />
                      <path d="M6 12h.01" />
                      <path d="M18 12h.01" />
                    </svg>
                    Cash
                  </button>
                </div>
              </div>

              {/* Date + Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">
                    Paid on <span className="req">*</span>
                  </label>
                  <label className="inp" style={{ height: 38 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--hz-ink-3)" }}>
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="M3 10h18" />
                      <path d="M8 4v4" />
                      <path d="M16 4v4" />
                    </svg>
                    <input
                      type="date"
                      value={paidAt}
                      onChange={(e) => setPaidAt(e.target.value)}
                    />
                  </label>
                </div>
                <div>
                  <label className="field-label">
                    Reference
                    <span
                      style={{
                        color: "var(--hz-ink-3)",
                        fontWeight: 500,
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        textTransform: "none",
                        letterSpacing: 0,
                        marginLeft: 5,
                      }}
                    >
                      Optional
                    </span>
                  </label>
                  <label className="inp" style={{ height: 38 }}>
                    <input
                      placeholder="TRX-… or invoice #"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="field-label">
                  Note
                  <span
                    style={{
                      color: "var(--hz-ink-3)",
                      fontWeight: 500,
                      fontFamily: "var(--font-sans)",
                      fontSize: 13,
                      textTransform: "none",
                      letterSpacing: 0,
                      marginLeft: 5,
                    }}
                  >
                    Optional · staff-only
                  </span>
                </label>
                <textarea
                  className="inp"
                  rows={2}
                  style={{
                    height: "auto",
                    padding: "10px 12px",
                    fontFamily: "var(--font-sans)",
                    lineHeight: 1.4,
                    resize: "vertical",
                  }}
                  placeholder="e.g. paid at reception by mother"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Outcome preview */}
              {amtNum > 0 ? (
                <div
                  className="p-3 rounded-md"
                  style={{
                    background: "var(--hz-surface-2)",
                    border: "1px dashed var(--hz-line)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="status-pill"
                      style={{ color: "var(--hz-success)" }}
                    >
                      <span className="dot" style={{ background: "var(--hz-success)" }} />
                      After this payment
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-[13px] hz-mono">
                    <div>
                      <div
                        className="text-[11px] uppercase tracking-[.14em]"
                        style={{ color: "var(--hz-ink-3)" }}
                      >
                        Total paid
                      </div>
                      <div className="mt-0.5">
                        <span style={{ color: "var(--hz-ink-3)" }}>€{paidEur.toFixed(0)}</span>{" "}
                        <span style={{ color: "var(--hz-ink-3)" }}>→</span>{" "}
                        <span style={{ color: "var(--hz-ink)", fontWeight: 600 }}>
                          €{nextPaid.toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div
                        className="text-[11px] uppercase tracking-[.14em]"
                        style={{ color: "var(--hz-ink-3)" }}
                      >
                        Outstanding
                      </div>
                      <div className="mt-0.5">
                        <span style={{ color: "var(--hz-ink-3)" }}>
                          €{(remainingCents / 100).toFixed(0)}
                        </span>{" "}
                        <span style={{ color: "var(--hz-ink-3)" }}>→</span>{" "}
                        <span
                          style={{
                            color: isFullyPaidAfter ? "var(--hz-success)" : "var(--hz-ink)",
                            fontWeight: 600,
                          }}
                        >
                          €{nextOutstanding.toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div
                        className="text-[11px] uppercase tracking-[.14em]"
                        style={{ color: "var(--hz-ink-3)" }}
                      >
                        Status
                      </div>
                      <div className="mt-0.5">
                        <span style={{ color: aviStyle.c }}>
                          {urgencyTone === "danger"
                            ? "Overdue"
                            : urgencyTone === "warning"
                              ? "Partial"
                              : urgencyTone === "due"
                                ? "Due soon"
                                : "Open"}
                        </span>{" "}
                        <span style={{ color: "var(--hz-ink-3)" }}>→</span>{" "}
                        <span
                          style={{
                            color: isFullyPaidAfter
                              ? "var(--hz-success)"
                              : "var(--hz-warning)",
                            fontWeight: 600,
                          }}
                        >
                          {isFullyPaidAfter ? "Paid" : "Partial"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p
                  className="text-[14px]"
                  style={{ color: "var(--hz-danger)" }}
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </div>

            {/* Footer */}
            <footer
              className="hair-t px-5 py-3 flex items-center justify-between"
              style={{ background: "var(--hz-surface-2)" }}
            >
              <span
                className="text-[12px] hz-mono"
                style={{ color: "var(--hz-ink-3)" }}
              >
                Esc to cancel · ⌘↵ to save
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-ghost"
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="btn-primary"
                  disabled={pending || amtNum <= 0}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  {pending ? "Saving…" : "Save payment"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
