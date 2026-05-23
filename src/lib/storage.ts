// Thin wrapper over Supabase Storage. Uploads land in the private
// `student-documents` bucket; reads go via signed URLs (default 1 hour TTL).
//
// Server-only: uses the service_role key. Never import this from a client
// component.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "student-documents";

let adminClient: SupabaseClient | null = null;

function getAdminClient() {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL or service role key missing");
  }
  adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

/**
 * Upload a file to the student-documents bucket, namespaced under the
 * given student id.
 */
export async function uploadStudentDoc({
  studentId,
  filename,
  file,
}: {
  studentId: string;
  /** Use a short filename like `passport-front.pdf`. */
  filename: string;
  file: File | Blob;
}): Promise<{ storagePath: string }> {
  const supabase = getAdminClient();
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `students/${studentId}/${Date.now()}-${safe}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file instanceof File ? file.type : undefined,
      upsert: false,
    });
  if (error) {
    throw new Error(`Upload failed (${ext}): ${error.message}`);
  }
  return { storagePath };
}

/** Returns a signed URL that's valid for `ttlSeconds` (default 1 hour). */
export async function getSignedDocUrl(
  storagePath: string,
  ttlSeconds = 3600,
): Promise<string> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data) {
    throw new Error(`Signed URL failed: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

/** Soft delete — actually deletes from storage. Used by future admin "replace doc" flow. */
export async function deleteStudentDoc(storagePath: string) {
  const supabase = getAdminClient();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

// =========================================================================
// Teacher profile uploads — photo + CV. Same bucket as student docs but
// prefixed under `teachers/<userId>/` so future bucket-level ACL changes
// can split them cleanly. Old uploads aren't auto-deleted on replace —
// callers should pass the prior storagePath to deleteStudentDoc.
// =========================================================================

export type TeacherFileKind = "photo" | "cv";

export async function uploadTeacherFile({
  userId,
  kind,
  filename,
  file,
}: {
  userId: string;
  kind: TeacherFileKind;
  filename: string;
  file: File | Blob;
}): Promise<{ storagePath: string }> {
  const supabase = getAdminClient();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `teachers/${userId}/${kind}-${Date.now()}-${safe}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file instanceof File ? file.type : undefined,
      upsert: false,
    });
  if (error) {
    throw new Error(`Upload failed (${kind}): ${error.message}`);
  }
  return { storagePath };
}
