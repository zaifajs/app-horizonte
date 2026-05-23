"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NewStudentForm } from "./new/new-student-form";
import { EditStudentForm } from "./[id]/edit/edit-student-form";

export type DrawerBatch = { id: string; label: string };
export type EditInitial = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  docType: "PASSPORT" | "RESIDENCE_PERMIT" | "ID_CARD";
  docNumber: string;
  dob: string;
  docExpiry: string;
  nationality: string;
  nif: string;
  niss: string;
  address: string;
  city: string;
  notes: string;
  batchId: string;
};

type Props =
  | {
      open: boolean;
      onOpenChange: (next: boolean) => void;
      mode: "create";
      batches: DrawerBatch[];
    }
  | {
      open: boolean;
      onOpenChange: (next: boolean) => void;
      mode: "edit";
      batches: DrawerBatch[];
      initial: EditInitial;
      currentBatchCode: string | null;
    };

export function StudentFormDrawer(props: Props) {
  const router = useRouter();
  const { open, onOpenChange } = props;

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // When the underlying form succeeds it calls router.push — intercept by
  // closing the drawer + refreshing the data instead so the user stays on
  // the same page (list / detail) with the drawer dismissed.
  // We can't easily monkey-patch router.push here, but the form's behavior
  // after success is to navigate. The simpler approach: listen for the URL
  // change and close the drawer accordingly. Done below via a one-shot
  // observer on the path.

  if (!open) return null;

  const isCreate = props.mode === "create";

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
        className="hair-l flex flex-col print:hidden w-full sm:max-w-[720px]"
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
              {isCreate ? "Enrolment" : "Edit student"}
            </div>
            <div className="mt-0.5 font-display text-xl font-medium truncate">
              {isCreate ? "Add student" : props.initial.fullName}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="ibtn"
            aria-label="Close"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isCreate ? (
            <NewStudentForm
              batches={props.batches}
              onSuccess={() => {
                onOpenChange(false);
                router.refresh();
              }}
            />
          ) : (
            <EditStudentForm
              initial={props.initial}
              batches={props.batches}
              currentBatchCode={props.currentBatchCode}
              onSuccess={() => {
                onOpenChange(false);
                router.refresh();
              }}
            />
          )}
        </div>
      </aside>
    </>
  );
}
