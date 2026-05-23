"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignBatchTrainerAction } from "@/lib/actions/batches";

type Trainer = { id: string; name: string };

const UNASSIGNED = "__unassigned__";

export function TrainerAssign({
  batchId,
  currentTrainerId,
  trainers,
}: {
  batchId: string;
  currentTrainerId: string | null;
  trainers: Trainer[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(currentTrainerId ?? UNASSIGNED);
  const [error, setError] = useState<string | null>(null);

  const dirty = (selected === UNASSIGNED ? null : selected) !== currentTrainerId;

  // If the currently-assigned trainer isn't in the option list (inactive,
  // role changed, or deleted user), inject a stub so Radix Select doesn't
  // render the raw UUID in the trigger.
  const renderedTrainers =
    currentTrainerId && !trainers.some((t) => t.id === currentTrainerId)
      ? [{ id: currentTrainerId, name: "Unknown / inactive trainer" }, ...trainers]
      : trainers;

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await assignBatchTrainerAction({
        batchId,
        trainerId: selected === UNASSIGNED ? null : selected,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">Trainer</div>
      <div className="mt-1 flex items-center gap-2">
        <Select value={selected} onValueChange={(v) => v && setSelected(v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {renderedTrainers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={onSave}
          disabled={!dirty || pending}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
