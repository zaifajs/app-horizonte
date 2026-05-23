"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import { sendEmail } from "@/lib/messaging/email";

function pickLocale(
  raw: unknown,
  locale: Locale,
): string | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const v = obj[locale];
  if (typeof v === "string" && v.length > 0) return v;
  const en = obj.en;
  if (typeof en === "string" && en.length > 0) return en;
  return null;
}
import {
  interpolate,
  renderEmailSubject,
  renderTemplate,
  type TemplateKey,
  type TemplateVars,
} from "@/lib/messaging/templates";
import type { Locale } from "@/i18n/routing";
import { localeForNationality } from "@/lib/messaging/locale-for-nationality";

const schema = z.object({
  studentId: z.string().uuid(),
  templateKey: z.enum(["welcome", "payment_reminder", "class_reminder", "cronograma"]),
  body: z.string().min(1).max(4000),
  channel: z.enum(["WA_ME", "EMAIL"]),
});

export type LogMessageInput = z.input<typeof schema>;
export type LogMessageResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/**
 * Records that a message was sent. For WA_ME this is fire-after-click —
 * we can't truly confirm WhatsApp delivery from outside, but we know the
 * staff member clicked the link.
 */
export async function logMessageSentAction(
  raw: LogMessageInput,
): Promise<LogMessageResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const message = await prisma.$transaction(async (tx) => {
    const entry = await tx.messageLog.create({
      data: {
        studentId: input.studentId,
        templateKey: input.templateKey,
        body: input.body,
        sentVia: input.channel,
        sentById: user.id,
      },
    });
    await logChange({
      tx,
      action: "CREATE",
      entityType: "MessageLog",
      entityId: entry.id,
      actorUserId: user.id,
      studentId: input.studentId,
      changes: {
        templateKey: input.templateKey,
        channel: input.channel,
        bodyPreview: input.body.slice(0, 80),
      },
    });
    return entry;
  });

  revalidatePath(`/admin/students/${input.studentId}`);
  return { ok: true, messageId: message.id };
}

// ---------------------------------------------------------------- email

const sendEmailSchema = z.object({
  studentId: z.string().uuid(),
  templateKey: z.enum(["welcome", "payment_reminder", "class_reminder", "cronograma"]),
  /** Optional body override. If absent we render the template fresh server-side. */
  bodyOverride: z.string().max(8000).optional(),
  subjectOverride: z.string().max(240).optional(),
  /** Per-student data for placeholders. */
  vars: z
    .object({
      name: z.string(),
      batch: z.string(),
      startDate: z.string().optional(),
      dueAmount: z.string().optional(),
      nextSessionDate: z.string().optional(),
      scheduleUrl: z.string().optional(),
    })
    .strict(),
});

export type SendEmailInput = z.input<typeof sendEmailSchema>;
export type SendEmailToStudentResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export async function sendEmailToStudentAction(
  raw: SendEmailInput,
): Promise<SendEmailToStudentResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);
  const parsed = sendEmailSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { id: true, email: true, nationality: true, fullName: true },
  });
  if (!student) return { ok: false, error: "Student not found." };
  if (!student.email) return { ok: false, error: "Student has no email on file." };

  const locale = localeForNationality(student.nationality);
  const vars: TemplateVars = input.vars;

  // Check for an admin-edited override in the DB before falling back to
  // the hardcoded default in templates.ts.
  const dbRow = await prisma.messageTemplate.findUnique({
    where: { key: input.templateKey },
  });
  const dbBody = pickLocale(dbRow?.bodies, locale);
  const dbSubject = pickLocale(dbRow?.subjects, locale);

  const subject =
    input.subjectOverride ??
    (dbSubject ? interpolate(dbSubject, vars) : null) ??
    renderEmailSubject(input.templateKey as TemplateKey, locale, vars);
  const body =
    input.bodyOverride ??
    (dbBody ? interpolate(dbBody, vars) : null) ??
    renderTemplate(input.templateKey as TemplateKey, locale, vars);

  const result = await sendEmail({ to: student.email, subject, body });

  await prisma.$transaction(async (tx) => {
    const entry = await tx.messageLog.create({
      data: {
        studentId: student.id,
        templateKey: input.templateKey,
        body: `Subject: ${subject}\n\n${body}`,
        sentVia: "EMAIL",
        sentById: user.id,
        status: result.ok ? "SENT" : "FAILED",
        errorMessage: result.ok ? null : result.error,
      },
    });
    await logChange({
      tx,
      action: "CREATE",
      entityType: "MessageLog",
      entityId: entry.id,
      actorUserId: user.id,
      studentId: student.id,
      changes: {
        channel: "EMAIL",
        templateKey: input.templateKey,
        recipient: student.email,
        subject,
        status: result.ok ? "SENT" : "FAILED",
        error: result.ok ? null : result.error,
      },
    });
  });

  revalidatePath(`/admin/students/${student.id}`);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, messageId: result.messageId };
}
