import { z } from "zod";

// Shared schema for staff "Add student" and public registration.
// Files (passport/permit) are uploaded separately — not part of this schema.

export const docTypeEnum = z.enum(["PASSPORT", "RESIDENCE_PERMIT", "ID_CARD"]);

export const studentCoreSchema = z.object({
  fullName: z.string().min(1, "Full name is required.").max(120),
  email: z.string().email("Enter a valid email."),
  phone: z
    .string()
    .min(7, "Phone number looks too short.")
    .max(20)
    .regex(/^\+?[0-9 ()-]+$/, "Use digits, spaces, +, -, ()."),
  docType: docTypeEnum,
  docNumber: z.string().min(1, "Document number is required.").max(40),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  docExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  nationality: z.string().min(1, "Nationality is required.").max(80),
  nif: z.string().min(1, "NIF is required.").max(20),
  niss: z.string().max(20).optional().nullable().transform((v) => v || null),
  address: z.string().min(1, "Address is required.").max(240),
  city: z.string().min(1, "City is required.").max(80),
  gdprConsent: z.literal(true, {
    error: () => ({ message: "GDPR consent is required." }),
  }),
  /** Optional initial enrollment. If set, two Payment rows are auto-created. */
  batchId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .transform((v) => (v === "" || v == null ? null : v)),
  notes: z.string().max(2000).optional().nullable().transform((v) => v || null),
});

export type StudentCoreInput = z.input<typeof studentCoreSchema>;
export type StudentCoreData = z.output<typeof studentCoreSchema>;
