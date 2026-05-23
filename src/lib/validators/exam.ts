import { z } from "zod";

// Question payload shape that admin authoring sends to the server. id is
// optional because new questions don't have one yet — server creates a UUID
// when saving them.
export const examQuestionInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    position: z.number().int().min(0),
    type: z.enum(["MC", "FILL", "OPEN"]),
    prompt: z.string().min(1, "Question prompt can't be empty.").max(2000),
    points: z.coerce.number().int().min(1, "At least 1 point.").max(100),
    choices: z.array(z.string()).default([]),
    correctIndex: z.number().int().min(0).nullable().default(null),
    acceptedAnswers: z.array(z.string()).default([]),
  })
  .superRefine((q, ctx) => {
    if (q.type === "MC") {
      if (q.choices.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multiple-choice questions need at least 2 choices.",
          path: ["choices"],
        });
      }
      if (q.correctIndex === null || q.correctIndex >= q.choices.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pick which choice is correct.",
          path: ["correctIndex"],
        });
      }
    }
    if (q.type === "FILL") {
      const trimmed = q.acceptedAnswers.map((a) => a.trim()).filter(Boolean);
      if (trimmed.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Add at least one accepted answer.",
          path: ["acceptedAnswers"],
        });
      }
    }
  });

export const examSaveSchema = z.object({
  moduleId: z.string().uuid("Invalid module."),
  title: z.string().min(1, "Exam title is required.").max(200),
  passingScore: z.coerce
    .number()
    .int("Whole numbers only.")
    .min(0, "Must be 0–100.")
    .max(100, "Must be 0–100."),
  durationMinutes: z.coerce
    .number()
    .int("Whole minutes only.")
    .min(1, "At least 1 minute.")
    .max(360, "Above 6 hours seems unreasonable."),
  questions: z.array(examQuestionInputSchema),
});

export type ExamSaveInput = z.input<typeof examSaveSchema>;
export type ExamQuestionInput = z.input<typeof examQuestionInputSchema>;

// Used by P3 — schedule an exam session for a batch+module.
export const scheduleExamSessionSchema = z.object({
  batchId: z.string().uuid(),
  moduleId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM."),
  durationMinutes: z.coerce.number().int().min(1).max(360),
});
export type ScheduleExamSessionInput = z.input<typeof scheduleExamSessionSchema>;

// Used by P5 — teacher grades a single submission's OPEN answers.
export const gradeExamSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  grades: z.array(
    z.object({
      answerId: z.string().uuid(),
      pointsAwarded: z.coerce.number().int().min(0),
    }),
  ),
});
export type GradeExamSubmissionInput = z.input<typeof gradeExamSubmissionSchema>;
