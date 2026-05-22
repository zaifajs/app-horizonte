"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkWhatsAppQueue, type BulkRow } from "./bulk-whatsapp-queue";

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
};

const SelectionCtx = createContext<Ctx | null>(null);

export function useSelection() {
  const v = useContext(SelectionCtx);
  if (!v) throw new Error("useSelection must be inside SelectionProvider");
  return v;
}

export function SelectionProvider({
  allIds,
  rowsForQueue,
  children,
}: {
  allIds: string[];
  rowsForQueue: Map<string, BulkRow>;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queueOpen, setQueueOpen] = useState(false);

  const ctx: Ctx = useMemo(
    () => ({
      selected,
      isSelected: (id) => selected.has(id),
      toggle: (id) => {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      },
      toggleAll: (ids) => {
        setSelected((prev) => {
          const allSelected = ids.every((id) => prev.has(id));
          if (allSelected) {
            const next = new Set(prev);
            for (const id of ids) next.delete(id);
            return next;
          }
          const next = new Set(prev);
          for (const id of ids) next.add(id);
          return next;
        });
      },
      clear: () => setSelected(new Set()),
    }),
    [selected],
  );

  const selectedRows = useMemo(
    () =>
      Array.from(selected)
        .map((id) => rowsForQueue.get(id))
        .filter((r): r is BulkRow => !!r),
    [selected, rowsForQueue],
  );

  return (
    <SelectionCtx.Provider value={ctx}>
      {children}

      {selected.size > 0 ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-zinc-900 text-white shadow-2xl px-2 py-1.5">
          <span className="px-2 text-xs font-medium tabular-nums">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setQueueOpen(true)}
            className="rounded-full"
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Send WhatsApp
          </Button>
          <button
            type="button"
            onClick={ctx.clear}
            className="h-7 w-7 rounded-full hover:bg-white/10 flex items-center justify-center"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <BulkWhatsAppQueue
        open={queueOpen}
        onOpenChange={setQueueOpen}
        rows={selectedRows}
      />
    </SelectionCtx.Provider>
  );
}

export function SelectAllCheckbox({ rowIds }: { rowIds: string[] }) {
  const { selected, toggleAll } = useSelection();
  const ref = useRef<HTMLInputElement>(null);
  const selectedCount = rowIds.filter((id) => selected.has(id)).length;
  const allSelected = rowIds.length > 0 && selectedCount === rowIds.length;
  const indeterminate = selectedCount > 0 && selectedCount < rowIds.length;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className={`hz-cb ${indeterminate ? "indeterminate" : ""}`}
      checked={allSelected}
      onChange={() => toggleAll(rowIds)}
      aria-label="Select all"
    />
  );
}

export function RowCheckbox({ id }: { id: string }) {
  const { isSelected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      className="hz-cb"
      data-no-navigate
      checked={isSelected(id)}
      onChange={() => toggle(id)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Select row"
    />
  );
}
