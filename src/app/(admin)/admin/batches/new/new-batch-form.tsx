"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBatchAction } from "@/lib/actions/batches";

type Course = {
  id: string;
  code: string;
  name: string;
  moduleCount: number;
  classroomDays: number;
};
type Trainer = { id: string; name: string };

const UNASSIGNED = "__unassigned__";

export function NewBatchForm({
  courses,
  trainers,
}: {
  courses: Course[];
  trainers: Trainer[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("14:00");
  const [durationHours, setDurationHours] = useState("4");
  const [capacity, setCapacity] = useState("25");
  const [trainerId, setTrainerId] = useState<string>(UNASSIGNED);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await createBatchAction({
        courseId,
        code: code.trim(),
        startDate,
        startTime,
        durationHours: Number(durationHours),
        capacity: Number(capacity),
        trainerId: trainerId === UNASSIGNED ? null : trainerId,
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.push(`/admin/batches/${result.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl border bg-card p-6">
      <Field
        label="Course"
        htmlFor="courseId"
        error={fieldErrors.courseId}
        hint={(() => {
          const c = courses.find((x) => x.id === courseId);
          if (!c) return "Currently only one course is offered.";
          const classroom = c.moduleCount * c.classroomDays;
          return `${c.code}: ${c.moduleCount} modules × ${c.classroomDays} classroom days + ${c.moduleCount} homework blocks (${classroom + c.moduleCount} sessions).`;
        })()}
      >
        <Select value={courseId} onValueChange={(v) => v && setCourseId(v)}>
          <SelectTrigger id="courseId">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.code} — {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Batch code"
        htmlFor="code"
        error={fieldErrors.code}
        hint="A short label like M9, J5, A14. Must be unique."
      >
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="M9"
          maxLength={20}
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Start date"
          htmlFor="startDate"
          error={fieldErrors.startDate}
        >
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </Field>

        <Field
          label="Start time"
          htmlFor="startTime"
          error={fieldErrors.startTime}
        >
          <Input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Hours per day"
          htmlFor="durationHours"
          error={fieldErrors.durationHours}
        >
          <Input
            id="durationHours"
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
          htmlFor="capacity"
          error={fieldErrors.capacity}
        >
          <Input
            id="capacity"
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
        label="Trainer"
        htmlFor="trainerId"
        error={fieldErrors.trainerId}
        hint={
          trainers.length === 0
            ? "No teachers yet — invite one from Users, or leave unassigned for now."
            : "Optional. You can assign later."
        }
      >
        <Select value={trainerId} onValueChange={(v) => v && setTrainerId(v)}>
          <SelectTrigger id="trainerId">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {trainers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create batch"}
        </Button>
      </div>
    </form>
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
