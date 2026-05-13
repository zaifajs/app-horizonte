"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  type ExportColumnKey,
} from "@/lib/students/export-columns";

const LS_KEY = "horizonte.exportCols";

export function ExportDialog() {
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<ExportColumnKey>>(
    new Set(DEFAULT_EXPORT_COLUMNS),
  );

  // Restore last-used selection from localStorage on open.
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
      const arr = JSON.parse(raw) as ExportColumnKey[];
      const valid = new Set(EXPORT_COLUMNS.map((c) => c.key));
      const next = new Set<ExportColumnKey>();
      for (const k of arr) {
        if (valid.has(k as ExportColumnKey)) next.add(k as ExportColumnKey);
      }
      if (next.size > 0) setTimeout(() => setSelected(next), 0);
    } catch {
      /* ignore parse errors */
    }
  }, [open]);

  function toggle(key: ExportColumnKey) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(EXPORT_COLUMNS.map((c) => c.key)));
  }
  function selectNone() {
    setSelected(new Set());
  }
  function selectDefaults() {
    setSelected(new Set(DEFAULT_EXPORT_COLUMNS));
  }

  function download() {
    const orderedKeys = EXPORT_COLUMNS
      .map((c) => c.key)
      .filter((k) => selected.has(k));
    if (orderedKeys.length === 0) return;
    // Persist for next time
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_KEY, JSON.stringify(orderedKeys));
    }

    const params = new URLSearchParams(sp.toString());
    params.set("cols", orderedKeys.join(","));
    const href = `/api/students/export?${params.toString()}`;
    // Open in a new tab so Next.js doesn't try to render it
    window.location.href = href;
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline">Export CSV…</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose columns to export</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <button type="button" onClick={selectAll} className="underline text-muted-foreground hover:text-foreground">
              Select all
            </button>
            <span className="text-muted-foreground">·</span>
            <button type="button" onClick={selectNone} className="underline text-muted-foreground hover:text-foreground">
              Select none
            </button>
            <span className="text-muted-foreground">·</span>
            <button type="button" onClick={selectDefaults} className="underline text-muted-foreground hover:text-foreground">
              Reset to defaults
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-[60vh] overflow-auto">
            {EXPORT_COLUMNS.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                <input
                  id={`col-${c.key}`}
                  type="checkbox"
                  checked={selected.has(c.key)}
                  onChange={() => toggle(c.key)}
                />
                <label htmlFor={`col-${c.key}`} className="text-sm">
                  {c.label}
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Selected columns are exported in the order shown here. Your choice
            is remembered in this browser. Filters and sort from the current
            page are applied.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={download} disabled={selected.size === 0}>
            Download CSV ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
