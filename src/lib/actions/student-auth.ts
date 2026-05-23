"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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

const schema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(200),
});

export type ProvisionStudentAuthBulkInput = z.input<typeof schema>;
export type ProvisionStudentAuthBulkResult = {
  ok: true;
  invited: number;
  alreadyLinked: number;
  failed: { id: string; email: string; reason: string }[];
};

export async function provisionStudentAuthBulk(
  raw: ProvisionStudentAuthBulkInput,
): Promise<ProvisionStudentAuthBulkResult | { ok: false; error: string }> {
  const actor = await requireRole(["ADMIN", "STAFF"]);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const students = await prisma.student.findMany({
    where: { id: { in: parsed.data.studentIds } },
    select: { id: true, email: true, fullName: true, userId: true },
  });

  const supabase = supabaseAdmin();
  const redirectTo = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/set-password`
    : undefined;

  let invited = 0;
  let alreadyLinked = 0;
  const failed: { id: string; email: string; reason: string }[] = [];

  for (const s of students) {
    if (s.userId) {
      alreadyLinked++;
      continue;
    }

    const email = s.email.toLowerCase();

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { name: s.fullName, role: "STUDENT" },
      redirectTo,
    });
    if (error || !data.user) {
      failed.push({ id: s.id, email, reason: error?.message ?? "Couldn't send the invite." });
      continue;
    }

    const userId = data.user.id;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.upsert({
          where: { id: userId },
          create: {
            id: userId,
            email,
            name: s.fullName,
            role: "STUDENT",
          },
          update: {
            email,
            name: s.fullName,
            role: "STUDENT",
            isActive: true,
          },
        });
        await tx.student.update({
          where: { id: s.id },
          data: { userId },
        });
        await logChange({
          tx,
          action: "CREATE",
          entityType: "User",
          entityId: userId,
          actorUserId: actor.id,
          studentId: s.id,
          changes: {
            email,
            name: s.fullName,
            role: "STUDENT",
            via: "student-portal-invite",
          } as Prisma.InputJsonValue,
        });
      });
      invited++;
    } catch (err) {
      console.error("provisionStudentAuthBulk DB write failed:", err);
      await supabase.auth.admin.deleteUser(userId).catch((e) =>
        console.error("cleanup: failed to delete Supabase user", e),
      );
      failed.push({ id: s.id, email, reason: "Failed to save the user record." });
    }
  }

  if (invited > 0) revalidatePath("/admin/students");
  return { ok: true, invited, alreadyLinked, failed };
}
