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
    kind: "CLASSROOM" | "AUTONOMOUS";
    notes: string | null;
  };
  isToday: boolean;
};

export function SessionRow({ session, isToday }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
        scheduledDate: date,
        startTime: session.kind === "AUTONOMOUS" ? null : start,
        endTime: session.kind === "AUTONOMOUS" ? null : end,
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

  return (
    <tr className={isToday ? "bg-amber-50" : ""}>
      <td className="px-3 py-2 text-muted-foreground">
        {session.sequenceInModule}
      </td>
      <td className="px-3 py-2">
        {format(session.scheduledDate, "EEE, dd MMM yyyy")}
      </td>
      <td className="px-3 py-2">
        {session.startTime ? `${session.startTime}–${session.endTime}` : "—"}
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
              <DialogTitle>Edit session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor={`date-${session.id}`}>Date</Label>
                <Input
                  id={`date-${session.id}`}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              {session.kind === "CLASSROOM" ? (
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
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor={`status-${session.id}`}>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => v && setStatus(v as Status)}
                >
                  <SelectTrigger id={`status-${session.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="HELD">Held</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`notes-${session.id}`}>
                  Notes
                  {status === "CANCELLED" ? (
                    <span className="text-destructive"> · required for cancellations</span>
                  ) : null}
                </Label>
                <Textarea
                  id={`notes-${session.id}`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional reason or note for this session."
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
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
    HELD: { label: "Held", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    CANCELLED: { label: "Cancelled", cls: "bg-red-50 border-red-200 text-red-700" },
    RESCHEDULED: { label: "Rescheduled", cls: "bg-blue-50 border-blue-200 text-blue-700" },
  };
  const m = map[status];
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}
