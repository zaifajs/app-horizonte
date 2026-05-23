import { z } from "zod";

// Locale codes we recognise for the "languages taught/spoken" tag list.
// Anything else is silently stripped at save time.
export const SUPPORTED_LOCALES = ["pt", "en", "bn", "ur", "hi"] as const;
export type TeacherLocale = (typeof SUPPORTED_LOCALES)[number];

// Payload from the self-service profile page + the admin edit form. We
// accept languages as either a comma-separated string OR an array; storage
// is always the comma-separated string so the schema stays flat.
export const teacherProfileSaveSchema = z.object({
  // Optional — admin needs to pass the userId of the teacher being edited.
  // For self-service /teacher/profile, the action ignores it and uses the
  // authed user's id.
  userId: z.string().uuid().optional(),
  // Display name lives on User.name (shared with every other surface), not
  // on TeacherProfile. The save action writes it across both rows in one
  // transaction.
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name is too long."),
  bio: z.string().max(2000).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  languages: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (!v) return null;
      const list = Array.isArray(v)
        ? v
        : v
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
      const allowed = new Set(SUPPORTED_LOCALES as readonly string[]);
      const kept = list.filter((l) => allowed.has(l));
      return kept.length > 0 ? kept.join(",") : null;
    }),
});

export type TeacherProfileSaveInput = z.input<typeof teacherProfileSaveSchema>;
