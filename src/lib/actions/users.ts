"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, type UserRole } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin keys missing");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ------------------------------ invite

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email."),
  name: z.string().min(1, "Name is required.").max(120),
  role: z.enum(["ADMIN", "STAFF", "TEACHER"]),
});

export type InviteUserInput = z.input<typeof inviteSchema>;
export type InviteUserResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function inviteUserAction(
  raw: InviteUserInput,
): Promise<InviteUserResult> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] ||= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;
  const email = input.email.toLowerCase();

  const supabase = supabaseAdmin();
  const redirectTo =
    process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
      : undefined;
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name: input.name, role: input.role },
    redirectTo,
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Couldn't send the invite." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: data.user!.id },
        create: {
          id: data.user!.id,
          email,
          name: input.name,
          role: input.role as UserRole,
        },
        update: {
          email,
          name: input.name,
          role: input.role as UserRole,
          isActive: true,
        },
      });
      await logChange({
        tx,
        action: "CREATE",
        entityType: "User",
        entityId: data.user!.id,
        actorUserId: actor.id,
        changes: { email, name: input.name, role: input.role } as Prisma.InputJsonValue,
      });
    });
  } catch (err) {
    console.error("inviteUserAction DB write failed:", err);
    return {
      ok: false,
      error: "The invite email was sent, but our user record didn't save. Try again.",
    };
  }

  revalidatePath("/admin/users");
  return { ok: true, userId: data.user.id };
}

// ------------------------------ activate / deactivate

const toggleSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
});

export async function setUserActiveAction(
  raw: z.input<typeof toggleSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  if (parsed.data.userId === actor.id) {
    return { ok: false, error: "You can't deactivate your own account." };
  }

  const before = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { isActive: true, email: true, role: true },
  });
  if (!before) return { ok: false, error: "User not found." };
  if (before.isActive === parsed.data.isActive) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: parsed.data.userId },
      data: { isActive: parsed.data.isActive },
    });
    await logChange({
      tx,
      action: "UPDATE",
      entityType: "User",
      entityId: parsed.data.userId,
      actorUserId: actor.id,
      changes: {
        isActive: { from: before.isActive, to: parsed.data.isActive },
      },
    });
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

// ------------------------------ change role

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["ADMIN", "STAFF", "TEACHER", "STUDENT"]),
});

export async function setUserRoleAction(
  raw: z.input<typeof roleSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = roleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const before = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { role: true },
  });
  if (!before) return { ok: false, error: "User not found." };
  if (before.role === parsed.data.role) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: parsed.data.userId },
      data: { role: parsed.data.role as UserRole },
    });
    await logChange({
      tx,
      action: "UPDATE",
      entityType: "User",
      entityId: parsed.data.userId,
      actorUserId: actor.id,
      changes: { role: { from: before.role, to: parsed.data.role } },
    });
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
