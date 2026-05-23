import { z } from "zod";

export const batchCreateSchema = z.object({
  courseId: z.string().uuid("Pick a course."),
  code: z
    .string()
    .min(1, "Batch code is required.")
    .max(20, "Batch code is too long.")
    .regex(/^[A-Z0-9]+$/i, "Use letters and numbers only (no spaces)."),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM (24-hour)."),
  durationHours: z.coerce
    .number()
    .int("Whole hours only.")
    .min(1, "Must be at least 1 hour.")
    .max(12, "More than 12 hours per day is unrealistic."),
  capacity: z.coerce
    .number()
    .int("Whole number only.")
    .min(1, "Must be at least 1.")
    .max(200, "Above 200 looks like a typo."),
  trainerId: z
    .string()
    .uuid("Invalid trainer.")
    .optional()
    .nullable()
    .transform((v) => (v === "" || v == null ? null : v)),
});

export type BatchCreateInput = z.infer<typeof batchCreateSchema>;

// Edit-batch validator. Course is intentionally NOT editable post-creation
// because the 36-session schedule was generated from it. Trainer has its
// own dedicated action (assignBatchTrainerAction).
export const batchUpdateSchema = z.object({
  id: z.string().uuid("Invalid batch."),
  code: z
    .string()
    .min(1, "Batch code is required.")
    .max(20, "Batch code is too long.")
    .regex(/^[A-Z0-9]+$/i, "Use letters and numbers only (no spaces)."),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM (24-hour)."),
  durationHours: z.coerce
    .number()
    .int("Whole hours only.")
    .min(1, "Must be at least 1 hour.")
    .max(12, "More than 12 hours per day is unrealistic."),
  capacity: z.coerce
    .number()
    .int("Whole number only.")
    .min(1, "Must be at least 1.")
    .max(200, "Above 200 looks like a typo."),
  status: z.enum(["UPCOMING", "ACTIVE", "FINISHED", "CANCELLED"]),
});

export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;
