"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { BulkRow } from "./bulk-whatsapp-queue";

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
  rowsForQueue: Map<string, BulkRow>;
};

const SelectionCtx = createContext<Ctx | null>(null);

export function useSelection() {
  const v = useContext(SelectionCtx);
  if (!v) throw new Error("useSelection must be inside SelectionProvider");
  return v;
}

export function SelectionProvider({
  rowsForQueue,
  children,
}: {
  // `allIds` is no longer used externally — selection state is just a Set<string>.
  allIds?: string[];
  rowsForQueue: Map<string, BulkRow>;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
      rowsForQueue,
    }),
    [selected, rowsForQueue],
  );

  return <SelectionCtx.Provider value={ctx}>{children}</SelectionCtx.Provider>;
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
