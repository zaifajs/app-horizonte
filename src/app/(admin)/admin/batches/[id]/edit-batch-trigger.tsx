"use client";

import { useState } from "react";
import { EditBatchDrawer } from "./edit-batch-drawer";

type Status = "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED";

export function EditBatchTrigger({
  initial,
}: {
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
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost"
        title="Edit batch details"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Edit batch
      </button>
      <EditBatchDrawer open={open} onOpenChange={setOpen} initial={initial} />
    </>
  );
}
