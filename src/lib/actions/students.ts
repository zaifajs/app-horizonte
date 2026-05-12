"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type DocumentKind, type DocType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import { studentCoreSchema, type StudentCoreInput } from "@/lib/validators/student";
import { uploadStudentDoc } from "@/lib/storage";

export type CreateStudentResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type FileLike = File | Blob | null | undefined;

export type CreateStudentInput = StudentCoreInput & {
  docFront?: FileLike;
  docBack?: FileLike;
};

/**
 * Creates a Student row, optional Enrollment, optional 2 Payments,
 * uploads identity documents to Storage, writes audit log.
 *
 * Used by:
 *   - /admin/students/new                (staff path; requires admin/staff session)
 *   - /(public)/[locale]/register        (public path; no session — actor=null)
 *
 * Pass `requireStaff: true` for the staff path; defaults to false (public).
 */
export async function createStudentAction(
  raw: CreateStudentInput,
  options: { requireStaff?: boolean } = {},
): Promise<CreateStudentResult> {
  let actorUserId: string | null = null;
  if (options.requireStaff) {
    const user = await requireRole(["ADMIN", "STAFF"]);
    actorUserId = user.id;
  } else {
    const u = await getCurrentUser();
    actorUserId = u?.id ?? null;
  }

  const { docFront, docBack, ...corePayload } = raw;
  const parsed = studentCoreSchema.safeParse(corePayload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ||= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  // If a batch is selected, ensure it's open for enrolment.
  if (input.batchId) {
    const batch = await prisma.batch.findUnique({
      where: { id: input.batchId },
      select: { id: true, status: true, startDate: true },
    });
    if (!batch || batch.status !== "UPCOMING") {
      return {
        ok: false,
        error: "Selected batch is not open for enrolment.",
        fieldErrors: { batchId: "Not open for enrolment." },
      };
    }
  }

  try {
    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          fullName: input.fullName,
          email: input.email.toLowerCase(),
          phone: input.phone,
          docType: input.docType as DocType,
          docNumber: input.docNumber,
          dob: new Date(`${input.dob}T00:00:00Z`),
          docExpiry: new Date(`${input.docExpiry}T00:00:00Z`),
          nationality: input.nationality,
          nif: input.nif,
          niss: input.niss,
          address: input.address,
          city: input.city,
          gdprConsentAt: new Date(),
          notes: input.notes,
        },
      });

      if (input.batchId) {
        await tx.enrollment.create({
          data: {
            studentId: created.id,
            batchId: input.batchId,
          },
        });
        // Enrollment starts as PENDING (schema default). Staff records
        // payments via the detail page; the first one auto-activates.
      }

      await logChange({
        tx,
        action: "CREATE",
        entityType: "Student",
        entityId: created.id,
        actorUserId,
        studentId: created.id,
        changes: {
          fullName: { from: null, to: created.fullName },
          email: { from: null, to: created.email },
          phone: { from: null, to: created.phone },
          batchId: { from: null, to: input.batchId },
        },
      });

      return created;
    });

    // Document uploads happen AFTER the row is committed so we have a stable
    // student id for storage paths. Failures here are non-fatal — the student
    // is created either way; staff can re-upload later from the detail page.
    const docKindForType: Record<DocType, [DocumentKind, DocumentKind]> = {
      PASSPORT: ["PASSPORT_FRONT", "PASSPORT_BACK"],
      RESIDENCE_PERMIT: ["RESIDENCE_PERMIT_FRONT", "RESIDENCE_PERMIT_BACK"],
      ID_CARD: ["ID_CARD_FRONT", "ID_CARD_BACK"],
    };
    const [frontKind, backKind] = docKindForType[input.docType as DocType];

    if (docFront instanceof File && docFront.size > 0) {
      try {
        const { storagePath } = await uploadStudentDoc({
          studentId: student.id,
          filename: `${frontKind.toLowerCase()}-${docFront.name}`,
          file: docFront,
        });
        await prisma.document.create({
          data: {
            studentId: student.id,
            kind: frontKind,
            storagePath,
            expiresAt: new Date(`${input.docExpiry}T00:00:00Z`),
          },
        });
      } catch (e) {
        console.error("doc front upload failed:", e);
      }
    }
    if (docBack instanceof File && docBack.size > 0) {
      try {
        const { storagePath } = await uploadStudentDoc({
          studentId: student.id,
          filename: `${backKind.toLowerCase()}-${docBack.name}`,
          file: docBack,
        });
        await prisma.document.create({
          data: {
            studentId: student.id,
            kind: backKind,
            storagePath,
            expiresAt: new Date(`${input.docExpiry}T00:00:00Z`),
          },
        });
      } catch (e) {
        console.error("doc back upload failed:", e);
      }
    }

    revalidatePath("/admin/students");
    if (input.batchId) revalidatePath(`/admin/batches/${input.batchId}`);
    return { ok: true, id: student.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta as { target?: string[] } | undefined)?.target?.join(", ") ?? "field";
      return {
        ok: false,
        error: `A student with that ${target.includes("email") ? "email" : target} already exists.`,
        fieldErrors: target.includes("email")
          ? { email: "Email already registered." }
          : {},
      };
    }
    console.error("createStudentAction failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
