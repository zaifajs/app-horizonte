// Auth helpers used by Server Components / Server Actions.
//
//   getCurrentUser()             → AuthedUser | null
//   requireUser()                → AuthedUser  (redirects to /login if missing)
//   requireRole([roles])         → AuthedUser  (redirects/403 if wrong role)

import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

export type AuthedUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
};

export async function getCurrentUser(): Promise<AuthedUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!row || !row.isActive) return null;
  return row;
}

export async function requireUser(): Promise<AuthedUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireRole(
  allowed: UserRole[],
): Promise<AuthedUser> {
  const u = await requireUser();
  if (!allowed.includes(u.role)) {
    // 403: dormant student or wrong-role login.
    redirect("/forbidden");
  }
  return u;
}
