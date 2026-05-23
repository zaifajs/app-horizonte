"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import {
  teacherProfileSaveSchema,
  type TeacherProfileSaveInput,
} from "@/lib/validators/teacher-profile";
import {
  uploadTeacherFile,
  deleteStudentDoc,
  getSignedDocUrl,
  type TeacherFileKind,
} from "@/lib/storage";

export type TeacherProfileSaveResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Resolve which userId to operate on:
// - TEACHER: always their own id; the userId in the payload is ignored
//   so a teacher can't edit someone else's profile by tampering with the
//   form.
// - ADMIN/STAFF: the userId in the payload (must reference a TEACHER row).
async function resolveTargetUserId(
  payloadUserId: string | undefined,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const actor = await requireRole(["ADMIN", "STAFF", "TEACHER"]);
  if (actor.role === "TEACHER") {
    return { ok: true, userId: actor.id };
  }
  if (!payloadUserId) {
    return { ok: false, error: "Missing target user." };
  }
  const target = await prisma.user.findUnique({
    where: { id: payloadUserId },
    select: { id: true, role: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (target.role !== "TEACHER") {
    return { ok: false, error: "Profile only applies to TEACHER role." };
  }
  return { ok: true, userId: target.id };
}

export async function saveTeacherProfileAction(
  raw: TeacherProfileSaveInput,
): Promise<TeacherProfileSaveResult> {
  const actor = await requireRole(["ADMIN", "STAFF", "TEACHER"]);
  const parsed = teacherProfileSaveSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ||= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const target = await resolveTargetUserId(parsed.data.userId);
  if (!target.ok) return target;

  // Normalise empty strings to null so the DB doesn't carry "" sentinels.
  const name = parsed.data.name;
  const bio = parsed.data.bio?.trim() || null;
  const phone = parsed.data.phone?.trim() || null;
  const languages = parsed.data.languages ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      // Snapshot current name so the audit row carries the diff. Skip the
      // User update + audit entry entirely when the name hasn't changed.
      const existing = await tx.user.findUnique({
        where: { id: target.userId },
        select: { name: true },
      });
      if (existing && existing.name !== name) {
        await tx.user.update({
          where: { id: target.userId },
          data: { name },
        });
        await logChange({
          tx,
          action: "UPDATE",
          entityType: "User",
          entityId: target.userId,
          actorUserId: actor.id,
          changes: {
            name: { from: existing.name, to: name },
          } as Prisma.InputJsonValue,
        });
      }

      const profile = await tx.teacherProfile.upsert({
        where: { userId: target.userId },
        create: { userId: target.userId, bio, phone, languages },
        update: { bio, phone, languages },
      });
      await logChange({
        tx,
        action: "UPDATE",
        entityType: "TeacherProfile",
        entityId: profile.id,
        actorUserId: actor.id,
        changes: { bio, phone, languages } as Prisma.InputJsonValue,
      });
    });
    revalidatePath("/teacher/profile");
    revalidatePath(`/admin/users/${target.userId}`);
    revalidatePath("/admin/users");
    return { ok: true, userId: target.userId };
  } catch (err) {
    console.error("saveTeacherProfileAction failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// ----------------------------------------------------------------- uploads

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB
const PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const CV_TYPES = new Set([
  "application/pdf",
]);

export type UploadResult =
  | { ok: true; storagePath: string }
  | { ok: false; error: string };

// Server action upload — accepts a multipart FormData with a single "file"
// field plus optional "userId" (admin path). Replaces any prior file of the
// same kind and deletes the old object from storage.
export async function uploadTeacherFileAction(
  kind: TeacherFileKind,
  formData: FormData,
): Promise<UploadResult> {
  const target = await resolveTargetUserId(
    formData.get("userId")?.toString() || undefined,
  );
  if (!target.ok) return target;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file uploaded." };
  }

  // Size + type gates.
  if (kind === "photo") {
    if (file.size > MAX_PHOTO_BYTES) {
      return { ok: false, error: "Photo too large (max 5 MB)." };
    }
    if (!PHOTO_TYPES.has(file.type)) {
      return { ok: false, error: "Photo must be JPG, PNG, or WEBP." };
    }
  } else {
    if (file.size > MAX_CV_BYTES) {
      return { ok: false, error: "CV too large (max 10 MB)." };
    }
    if (!CV_TYPES.has(file.type)) {
      return { ok: false, error: "CV must be a PDF." };
    }
  }

  // Look up the prior storage path so we can delete it after a successful
  // upload — keep the bucket clean.
  const existing = await prisma.teacherProfile.findUnique({
    where: { userId: target.userId },
    select: { id: true, photoStoragePath: true, cvStoragePath: true },
  });
  const prior =
    kind === "photo" ? existing?.photoStoragePath : existing?.cvStoragePath;

  let storagePath: string;
  try {
    const result = await uploadTeacherFile({
      userId: target.userId,
      kind,
      filename: file.name,
      file,
    });
    storagePath = result.storagePath;
  } catch (err) {
    console.error("uploadTeacherFileAction upload failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }

  try {
    await prisma.teacherProfile.upsert({
      where: { userId: target.userId },
      create: {
        userId: target.userId,
        ...(kind === "photo"
          ? { photoStoragePath: storagePath }
          : { cvStoragePath: storagePath }),
      },
      update:
        kind === "photo"
          ? { photoStoragePath: storagePath }
          : { cvStoragePath: storagePath },
    });
  } catch (err) {
    console.error("uploadTeacherFileAction DB write failed:", err);
    // Cleanup orphaned upload.
    await deleteStudentDoc(storagePath).catch(() => {});
    return { ok: false, error: "Couldn't save the file path." };
  }

  // Best-effort delete of the prior file.
  if (prior) {
    await deleteStudentDoc(prior).catch((e) =>
      console.error("teacher upload: prior cleanup failed", e),
    );
  }

  revalidatePath("/teacher/profile");
  revalidatePath(`/admin/users/${target.userId}`);
  return { ok: true, storagePath };
}

// Convenience signed-URL fetcher for both photo + CV. The caller passes the
// storagePath read from TeacherProfile; we return a short-lived URL.
export async function getTeacherFileUrl(storagePath: string): Promise<string> {
  return getSignedDocUrl(storagePath, 3600);
}
