"use client";

import { type ReactNode, useState } from "react";
import {
  StudentFormDrawer,
  type DrawerBatch,
  type EditInitial,
} from "./student-form-drawer";

type CreateProps = {
  mode: "create";
  batches: DrawerBatch[];
  trigger?: (open: () => void) => ReactNode;
  /** Default button styling/label used when `trigger` isn't provided. */
  defaultLabel?: string;
  defaultClassName?: string;
};

type EditProps = {
  mode: "edit";
  batches: DrawerBatch[];
  initial: EditInitial;
  currentBatchCode: string | null;
  trigger?: (open: () => void) => ReactNode;
  defaultLabel?: string;
  defaultClassName?: string;
};

export function StudentFormTrigger(props: CreateProps | EditProps) {
  const [open, setOpen] = useState(false);
  const renderTrigger = props.trigger;
  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={props.defaultClassName ?? (props.mode === "create" ? "btn-primary" : "btn-ghost")}
        >
          {props.mode === "create" ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          ) : null}
          {props.defaultLabel ?? (props.mode === "create" ? "New student" : "Edit")}
        </button>
      )}
      {props.mode === "create" ? (
        <StudentFormDrawer
          mode="create"
          batches={props.batches}
          open={open}
          onOpenChange={setOpen}
        />
      ) : (
        <StudentFormDrawer
          mode="edit"
          batches={props.batches}
          initial={props.initial}
          currentBatchCode={props.currentBatchCode}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
