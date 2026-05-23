"use client";

import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { SessionRow } from "./session-row";

type SessionForRow = {
  id: string;
  scheduledDate: Date;
  startTime: string | null;
  endTime: string | null;
  sequenceInModule: number;
  status: "SCHEDULED" | "HELD" | "CANCELLED" | "RESCHEDULED";
  hours: number;
  notes: string | null;
};

type ModuleStatus = "UPCOMING" | "IN_PROGRESS" | "DONE";

export function ModuleSection({
  number,
  name,
  status,
  first,
  last,
  hoursLogged,
  hoursPlanned,
  classroom,
  autonomous,
  today,
  defaultOpen,
}: {
  number: number;
  name: string;
  status: ModuleStatus;
  first: Date | null;
  last: Date | null;
  hoursLogged: number;
  hoursPlanned: number;
  classroom: SessionForRow[];
  autonomous: SessionForRow | null;
  today: Date;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tone =
    status === "DONE"
      ? "var(--hz-success)"
      : status === "IN_PROGRESS"
        ? "var(--hz-primary)"
        : "var(--hz-ink-3)";
  const statusLabel =
    status === "DONE" ? "Done" : status === "IN_PROGRESS" ? "Active" : "Upcoming";
  const pct = hoursPlanned > 0 ? Math.round((hoursLogged / hoursPlanned) * 100) : 0;

  return (
    <section
      id={`module-${number}`}
      className="hz-card overflow-hidden scroll-mt-4"
      style={{
        borderColor: status === "IN_PROGRESS" ? "var(--hz-primary)" : "var(--hz-line)",
      }}
    >
      {/* Header — click anywhere to toggle. Uses <button> for keyboard
          accessibility (Enter/Space toggle). */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`module-${number}-body`}
        className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-[var(--hz-surface-2)] transition-colors"
      >
        <span
          className="hz-mono text-xs font-semibold shrink-0"
          style={{ color: tone, letterSpacing: "0.16em", width: 64 }}
        >
          M{number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{name}</div>
          <div className="text-xs hz-mono mt-0.5" style={{ color: "var(--hz-ink-3)" }}>
            {first && last
              ? `${format(first, "MMM dd")} – ${format(last, "MMM dd")}`
              : "Dates pending"}
            <span className="mx-1.5">·</span>
            {hoursLogged} / {hoursPlanned} h
          </div>
        </div>
        <div className="hidden sm:block w-24">
          <div className="pbar">
            <span style={{ width: `${pct}%`, background: tone }} />
          </div>
        </div>
        <span
          className="status-pill shrink-0"
          style={{ color: tone, fontSize: "0.6875rem" }}
        >
          {statusLabel}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-[var(--hz-ink-3)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div id={`module-${number}-body`} className="overflow-x-auto hair-t">
          <table className="w-full text-sm">
            <thead style={{ background: "var(--hz-surface-2)" }}>
              <tr>
                <th
                  className="text-left px-3 py-2 w-12 hz-mono uppercase tracking-[.14em]"
                  style={{ color: "var(--hz-ink-3)", fontSize: "0.75rem" }}
                >
                  #
                </th>
                <th
                  className="text-left px-3 py-2 hz-mono uppercase tracking-[.14em]"
                  style={{ color: "var(--hz-ink-3)", fontSize: "0.75rem" }}
                >
                  Date
                </th>
                <th
                  className="text-left px-3 py-2 hz-mono uppercase tracking-[.14em]"
                  style={{ color: "var(--hz-ink-3)", fontSize: "0.75rem" }}
                >
                  Time
                </th>
                <th
                  className="text-left px-3 py-2 hz-mono uppercase tracking-[.14em]"
                  style={{ color: "var(--hz-ink-3)", fontSize: "0.75rem" }}
                >
                  Hours
                </th>
                <th
                  className="text-left px-3 py-2 hz-mono uppercase tracking-[.14em]"
                  style={{ color: "var(--hz-ink-3)", fontSize: "0.75rem" }}
                >
                  Status
                </th>
                <th className="text-right px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {classroom.map((s) => (
                <SessionRow
                  key={s.id}
                  session={{ ...s, kind: "CLASSROOM" }}
                  isToday={isSameDay(s.scheduledDate, today)}
                />
              ))}
              {autonomous ? (
                <SessionRow
                  session={{ ...autonomous, kind: "AUTONOMOUS" }}
                  isToday={isSameDay(autonomous.scheduledDate, today)}
                />
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
