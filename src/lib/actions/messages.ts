"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";

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
