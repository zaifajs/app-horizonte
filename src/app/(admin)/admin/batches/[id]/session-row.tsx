"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSessionAction } from "@/lib/actions/sessions";

type Status = "SCHEDULED" | "HELD" | "CANCELLED" | "RESCHEDULED";

type Props = {
  session: {
    id: string;
    sequenceInModule: number;
    scheduledDate: Date;
    startTime: string | null;
    endTime: string | null;
    hours: number;
    status: Status;
    kind: "CLASSROOM" | "AUTONOMOUS" | "EXAM";
    notes: string | null;
  };
  isToday: boolean;
};

export function SessionRow({ session, isToday }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isAutonomous = session.kind === "AUTONOMOUS";

  const initialDate = session.scheduledDate.toISOString().slice(0, 10);
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState(session.startTime ?? "");
  const [end, setEnd] = useState(session.endTime ?? "");
  const [status, setStatus] = useState<Status>(session.status);
  const [notes, setNotes] = useState(session.notes ?? "");

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateSessionAction({
        sessionId: session.id,
        // For autonomous, keep the existing date — UI never edits it.
        scheduledDate: isAutonomous ? initialDate : date,
        startTime: isAutonomous ? null : start,
        endTime: isAutonomous ? null : end,
        status,
        notes: notes.trim() === "" ? null : notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const rowClass = isAutonomous
    ? "bg-muted"
    : isToday
      ? "bg-[var(--hz-warning-50)]"
      : "";

  return (
    <tr className={rowClass}>
      <td className="px-3 py-2 text-muted-foreground">
        {isAutonomous ? "—" : session.sequenceInModule}
      </td>
      <td className="px-3 py-2">
        {isAutonomous ? (
          <span className="italic text-muted-foreground">Homework</span>
        ) : (
          format(session.scheduledDate, "EEE, dd MMM yyyy")
        )}
      </td>
      <td className="px-3 py-2">
        {isAutonomous
          ? "—"
          : `${session.startTime}–${session.endTime}`}
      </td>
      <td className="px-3 py-2">{session.hours}h</td>
      <td className="px-3 py-2">
        <SessionStatusBadge status={session.status} />
      </td>
      <td className="px-3 py-2 text-right">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isAutonomous ? "Edit homework block" : "Edit session"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isAutonomous ? null : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor={`date-${session.id}`}>Date</Label>
                    <Input
                      id={`date-${session.id}`}
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`start-${session.id}`}>Start time</Label>
                      <Input
                        id={`start-${session.id}`}
                        type="time"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`end-${session.id}`}>End time</Label>
                      <Input
                        id={`end-${session.id}`}
                        type="time"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor={`status-${session.id}`}>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => v && setStatus(v as Status)}
                >
                  <SelectTrigger id={`status-${session.id}`}>
                    <SelectValue>
                      {(v: string) => {
                        if (v === "SCHEDULED") return "Scheduled";
                        if (v === "HELD") return isAutonomous ? "Completed" : "Held";
                        if (v === "CANCELLED") return "Cancelled";
                        if (v === "RESCHEDULED") return "Rescheduled";
                        return "";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="HELD">
                      {isAutonomous ? "Completed" : "Held"}
                    </SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    {isAutonomous ? null : (
                      <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`notes-${session.id}`}>
                  Notes
                  {status === "CANCELLED" ? (
                    <span className="text-destructive">
                      {" "}
                      · required for cancellations
                    </span>
                  ) : null}
                </Label>
                <Textarea
                  id={`notes-${session.id}`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={
                    isAutonomous
                      ? "Optional note about the homework block."
                      : "Optional reason or note for this session."
                  }
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}

function SessionStatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    SCHEDULED: { label: "Scheduled", cls: "text-muted-foreground" },
    HELD: {
      label: "Held",
      cls: "chip chip-success",
    },
    CANCELLED: {
      label: "Cancelled",
      cls: "chip chip-danger",
    },
    RESCHEDULED: {
      label: "Rescheduled",
      cls: "bg-blue-50 border-blue-200 text-blue-700",
    },
  };
  const m = map[status];
  return (
    <Badge variant="outline" className={m.cls}>
      {m.label}
    </Badge>
  );
}
