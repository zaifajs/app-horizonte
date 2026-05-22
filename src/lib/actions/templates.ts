"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import { SYSTEM_TEMPLATE_KEYS } from "@/lib/messaging/template-store";

const localisedSchema = z
  .object({
    en: z.string().max(8000).optional(),
    pt: z.string().max(8000).optional(),
    bn: z.string().max(8000).optional(),
    ur: z.string().max(8000).optional(),
    hi: z.string().max(8000).optional(),
  })
  .strict();

const saveSchema = z.object({
  // Either id (existing custom) OR key (system) — for new custom templates,
  // both are absent and `name` is required.
  id: z.string().uuid().optional(),
  key: z.string().max(60).optional(),
  name: z.string().min(1, "Name is required.").max(120),
  bodies: localisedSchema,
  subjects: localisedSchema,
});

export type SaveTemplateInput = z.input<typeof saveSchema>;
export type SaveTemplateResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function saveTemplateAction(
  raw: SaveTemplateInput,
): Promise<SaveTemplateResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] ||= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;
  const isSystemKey = input.key && (SYSTEM_TEMPLATE_KEYS as string[]).includes(input.key);

  // System templates are upserted by key. Custom templates by id (or fresh).
  let resultId: string;
  if (isSystemKey && input.key) {
    const row = await prisma.messageTemplate.upsert({
      where: { key: input.key },
      update: {
        bodies: input.bodies,
        subjects: input.subjects,
        updatedById: user.id,
      },
      create: {
        key: input.key,
        name: input.name,
        isSystem: true,
        bodies: input.bodies,
        subjects: input.subjects,
        updatedById: user.id,
      },
    });
    resultId = row.id;
    await logChange({
      action: "UPDATE",
      entityType: "MessageTemplate",
      entityId: row.id,
      actorUserId: user.id,
      changes: { key: input.key, name: input.name },
    });
  } else if (input.id) {
    // Update existing custom template.
    const row = await prisma.messageTemplate.update({
      where: { id: input.id },
      data: {
        name: input.name,
        bodies: input.bodies,
        subjects: input.subjects,
        updatedById: user.id,
      },
    });
    resultId = row.id;
    await logChange({
      action: "UPDATE",
      entityType: "MessageTemplate",
      entityId: row.id,
      actorUserId: user.id,
      changes: { name: input.name },
    });
  } else {
    // Create a fresh custom template.
    const row = await prisma.messageTemplate.create({
      data: {
        name: input.name,
        isSystem: false,
        bodies: input.bodies,
        subjects: input.subjects,
        updatedById: user.id,
      },
    });
    resultId = row.id;
    await logChange({
      action: "CREATE",
      entityType: "MessageTemplate",
      entityId: row.id,
      actorUserId: user.id,
      changes: { name: input.name },
    });
  }

  revalidatePath("/admin/messages/templates");
  return { ok: true, id: resultId };
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteTemplateAction(
  raw: z.input<typeof deleteSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole(["ADMIN", "STAFF"]);
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const row = await prisma.messageTemplate.findUnique({ where: { id: parsed.data.id } });
  if (!row) return { ok: false, error: "Template not found." };
  if (row.isSystem) return { ok: false, error: "System templates can't be deleted." };
  await prisma.messageTemplate.delete({ where: { id: parsed.data.id } });
  await logChange({
    action: "DELETE",
    entityType: "MessageTemplate",
    entityId: row.id,
    actorUserId: user.id,
    changes: { name: row.name },
  });
  revalidatePath("/admin/messages/templates");
  return { ok: true };
}

const resetSchema = z.object({ key: z.string().max(60) });

/** Delete the DB override row for a system key so it reverts to the
 *  hardcoded default in templates.ts. */
export async function resetSystemTemplateAction(
  raw: z.input<typeof resetSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole(["ADMIN", "STAFF"]);
  const parsed = resetSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  if (!(SYSTEM_TEMPLATE_KEYS as string[]).includes(parsed.data.key)) {
    return { ok: false, error: "Not a system template." };
  }
  const row = await prisma.messageTemplate.findUnique({
    where: { key: parsed.data.key },
  });
  if (!row) return { ok: true }; // already at default
  await prisma.messageTemplate.delete({ where: { id: row.id } });
  await logChange({
    action: "DELETE",
    entityType: "MessageTemplate",
    entityId: row.id,
    actorUserId: user.id,
    changes: { reset: parsed.data.key },
  });
  revalidatePath("/admin/messages/templates");
  return { ok: true };
}
