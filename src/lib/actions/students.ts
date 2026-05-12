"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type DocumentKind, type DocType } from "@prisma/client";
import { z } from "zod";
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

// ---------------------------------------------------------------- update

const updateSchema = studentCoreSchema
  .omit({ gdprConsent: true })
  .extend({ id: z.string().uuid() });

export type UpdateStudentInput = z.input<typeof updateSchema>;

export type UpdateStudentResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Staff-side edit of student personal info. Audit-logs every changed field. */
export async function updateStudentAction(
  raw: UpdateStudentInput,
): Promise<UpdateStudentResult> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ||= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const before = await prisma.student.findUnique({ where: { id: input.id } });
  if (!before) return { ok: false, error: "Student not found." };

  const changed: Record<string, { from: unknown; to: unknown }> = {};
  function diff(field: string, fromVal: unknown, toVal: unknown) {
    if (fromVal === toVal) return;
    if (fromVal instanceof Date && toVal instanceof Date && fromVal.getTime() === toVal.getTime()) return;
    changed[field] = { from: fromVal, to: toVal };
  }

  const next = {
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
    notes: input.notes,
  };

  diff("fullName", before.fullName, next.fullName);
  diff("email", before.email, next.email);
  diff("phone", before.phone, next.phone);
  diff("docType", before.docType, next.docType);
  diff("docNumber", before.docNumber, next.docNumber);
  diff("dob", before.dob, next.dob);
  diff("docExpiry", before.docExpiry, next.docExpiry);
  diff("nationality", before.nationality, next.nationality);
  diff("nif", before.nif, next.nif);
  diff("niss", before.niss, next.niss);
  diff("address", before.address, next.address);
  diff("city", before.city, next.city);
  diff("notes", before.notes, next.notes);

  // Optional: move student to a different batch (or assign for the first time).
  // The latest enrollment row keeps its payments — only batchId changes.
  const currentEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: input.id },
    orderBy: { enrolledAt: "desc" },
    select: { id: true, batchId: true },
  });
  let batchChange:
    | { kind: "create" | "move"; fromBatchId: string | null; toBatchId: string }
    | null = null;
  if (input.batchId && input.batchId !== currentEnrollment?.batchId) {
    batchChange = {
      kind: currentEnrollment ? "move" : "create",
      fromBatchId: currentEnrollment?.batchId ?? null,
      toBatchId: input.batchId,
    };
  }

  if (Object.keys(changed).length === 0 && !batchChange) {
    return { ok: true };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(changed).length > 0) {
        await tx.student.update({ where: { id: input.id }, data: next });
        const changesForAudit = Object.fromEntries(
          Object.entries(changed).map(([k, v]) => [
            k,
            {
              from: v.from instanceof Date ? v.from.toISOString().slice(0, 10) : v.from,
              to: v.to instanceof Date ? v.to.toISOString().slice(0, 10) : v.to,
            },
          ]),
        );
        await logChange({
          tx,
          action: "UPDATE",
          entityType: "Student",
          entityId: input.id,
          actorUserId: user.id,
          studentId: input.id,
          changes: changesForAudit as Prisma.InputJsonValue,
        });
      }

      if (batchChange) {
        if (batchChange.kind === "move" && currentEnrollment) {
          await tx.enrollment.update({
            where: { id: currentEnrollment.id },
            data: { batchId: batchChange.toBatchId },
          });
          await logChange({
            tx,
            action: "UPDATE",
            entityType: "Enrollment",
            entityId: currentEnrollment.id,
            actorUserId: user.id,
            studentId: input.id,
            changes: {
              batchId: { from: batchChange.fromBatchId, to: batchChange.toBatchId },
              reason: "Student moved to a different batch.",
            } as Prisma.InputJsonValue,
          });
        } else {
          const created = await tx.enrollment.create({
            data: { studentId: input.id, batchId: batchChange.toBatchId },
          });
          await logChange({
            tx,
            action: "CREATE",
            entityType: "Enrollment",
            entityId: created.id,
            actorUserId: user.id,
            studentId: input.id,
            changes: { batchId: { from: null, to: batchChange.toBatchId } } as Prisma.InputJsonValue,
          });
        }
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        ok: false,
        error: "That email is already used by another student.",
        fieldErrors: { email: "Already in use." },
      };
    }
    console.error("updateStudentAction failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath(`/admin/students/${input.id}`);
  revalidatePath("/admin/students");
  return { ok: true };
}
