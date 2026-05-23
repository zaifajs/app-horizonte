"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateBatchAction } from "@/lib/actions/batches";

type Status = "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED";

const STATUS_LABEL: Record<Status, string> = {
  UPCOMING: "Upcoming",
  ACTIVE: "Active",
  FINISHED: "Finished",
  CANCELLED: "Cancelled",
};

export function EditBatchDrawer({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  initial: {
    id: string;
    code: string;
    startDate: string;
    startTime: string;
    durationHours: number;
    capacity: number;
    status: Status;
    deliveryMode: "IN_HOUSE" | "ONLINE";
    meetingUrl: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [code, setCode] = useState(initial.code);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [durationHours, setDurationHours] = useState(String(initial.durationHours));
  const [capacity, setCapacity] = useState(String(initial.capacity));
  const [status, setStatus] = useState<Status>(initial.status);
  const [deliveryMode, setDeliveryMode] = useState<"IN_HOUSE" | "ONLINE">(
    initial.deliveryMode,
  );
  const [meetingUrl, setMeetingUrl] = useState(initial.meetingUrl ?? "");

  // Reset fields whenever the drawer opens against a different batch.
  useEffect(() => {
    if (!open) return;
    setCode(initial.code);
    setStartDate(initial.startDate);
    setStartTime(initial.startTime);
    setDurationHours(String(initial.durationHours));
    setCapacity(String(initial.capacity));
    setStatus(initial.status);
    setDeliveryMode(initial.deliveryMode);
    setMeetingUrl(initial.meetingUrl ?? "");
    setError(null);
    setFieldErrors({});
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateBatchAction({
        id: initial.id,
        code: code.trim(),
        startDate,
        startTime,
        durationHours: Number(durationHours),
        capacity: Number(capacity),
        status,
        deliveryMode,
        meetingUrl: deliveryMode === "ONLINE" ? meetingUrl.trim() || null : null,
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(11,14,20,0.55)",
          backdropFilter: "blur(2px)",
          zIndex: 49,
        }}
      />
      <aside
        className="hair-l flex flex-col print:hidden w-full sm:max-w-[520px]"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          background: "var(--hz-surface)",
          zIndex: 50,
          boxShadow: "-16px 0 40px -16px rgba(0,0,0,0.6)",
          textAlign: "left",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <header className="hair-b px-5 py-4 flex items-center gap-2 shrink-0">
          <div className="flex-1 min-w-0">
            <div
              className="text-xs hz-mono uppercase tracking-[.16em]"
              style={{ color: "var(--hz-ink-3)" }}
            >
              Cronograma
            </div>
            <div className="mt-0.5 font-display text-xl font-medium truncate">
              Edit batch {initial.code}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="ibtn"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-4">
            <Field
              label="Batch code"
              htmlFor="batch-code"
              hint="Short label like M9, J5, A14."
              error={fieldErrors.code}
            >
              <Input
                id="batch-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={20}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Start date"
                htmlFor="batch-start-date"
                error={fieldErrors.startDate}
              >
                <Input
                  id="batch-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Start time"
                htmlFor="batch-start-time"
                error={fieldErrors.startTime}
              >
                <Input
                  id="batch-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Hours per day"
                htmlFor="batch-hours"
                error={fieldErrors.durationHours}
              >
                <Input
                  id="batch-hours"
                  type="number"
                  min={1}
                  max={12}
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Capacity"
                htmlFor="batch-capacity"
                error={fieldErrors.capacity}
              >
                <Input
                  id="batch-capacity"
                  type="number"
                  min={1}
                  max={200}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  required
                />
              </Field>
            </div>

            <Field
              label="Status"
              htmlFor="batch-status"
              error={fieldErrors.status}
              hint="Active = in flight; Finished = wrapped; Cancelled = stopped."
            >
              <Select
                value={status}
                onValueChange={(v) => v && setStatus(v as Status)}
              >
                <SelectTrigger id="batch-status">
                  <SelectValue>
                    {(v: string) => STATUS_LABEL[v as Status] ?? "Select status"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Delivery"
              htmlFor="batch-delivery"
              error={fieldErrors.deliveryMode}
              hint={
                deliveryMode === "ONLINE"
                  ? "Students see the meeting link on their schedule."
                  : "Sessions happen at the school."
              }
            >
              <Select
                value={deliveryMode}
                onValueChange={(v) => v && setDeliveryMode(v as "IN_HOUSE" | "ONLINE")}
              >
                <SelectTrigger id="batch-delivery">
                  <SelectValue>
                    {(v: string) => (v === "ONLINE" ? "Online" : "In-house (at the school)")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN_HOUSE">In-house (at the school)</SelectItem>
                  <SelectItem value="ONLINE">Online</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {deliveryMode === "ONLINE" ? (
              <Field
                label="Meeting link"
                htmlFor="batch-meeting-url"
                error={fieldErrors.meetingUrl}
                hint="Google Meet / Zoom / any URL."
              >
                <Input
                  id="batch-meeting-url"
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  required
                />
              </Field>
            ) : null}

            <p
              className="hz-mono text-xs"
              style={{ color: "var(--hz-ink-3)" }}
            >
              Note: changing start date or time does not retro-shift the
              already-generated sessions. Edit individual sessions below if
              the schedule needs to slip.
            </p>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div
            className="sticky bottom-0 px-5 py-3 flex items-center justify-end gap-2 hair-t"
            style={{
              background: "var(--hz-surface)",
              paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
            }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
