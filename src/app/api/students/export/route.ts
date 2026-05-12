import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  applyComputedFilters,
  buildStudentWhere,
  parseFilters,
  progressOf,
  sortRows,
  type StudentRow,
} from "@/lib/students/filters";

const HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Doc type",
  "Doc number",
  "DOB",
  "Nationality",
  "NIF",
  "NISS",
  "Address",
  "City",
  "Batch",
  "Enrollment status",
  "Course fee (EUR)",
  "Paid (EUR)",
  "Due (EUR)",
  "Last payment",
  "Registered",
];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  await requireRole(["ADMIN", "STAFF"]);

  const url = new URL(request.url);
  const sp: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (sp[k] = v));
  const filters = parseFilters(sp);
  const where = buildStudentWhere(filters);

  const students = await prisma.student.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      enrollments: {
        include: {
          batch: {
            select: { code: true, course: { select: { feeCents: true } } },
          },
          payments: { select: { amountCents: true, paidAt: true } },
        },
        orderBy: { enrolledAt: "desc" },
      },
    },
    take: 5000,
  });

  const rows: StudentRow[] = students.map((s) => {
    const enr = s.enrollments[0] ?? null;
    const paid = enr?.payments.reduce((a, p) => a + p.amountCents, 0) ?? 0;
    const fee = enr?.batch.course.feeCents ?? 0;
    const due = enr ? Math.max(0, fee - paid) : 0;
    const lastPaidAt =
      enr && enr.payments.length > 0
        ? enr.payments
            .map((p) => p.paidAt)
            .sort((a, b) => b.getTime() - a.getTime())[0]
        : null;
    return {
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      phone: s.phone,
      city: s.city,
      createdAt: s.createdAt,
      latestEnrollment: enr
        ? {
            id: enr.id,
            status: enr.status,
            batchCode: enr.batch.code,
            feeCents: fee,
          }
        : null,
      paidCents: paid,
      dueCents: due,
      lastPaidAt,
      paymentProgress: progressOf(paid, fee),
    };
  });

  const filtered = applyComputedFilters(rows, filters);
  const sorted = sortRows(filtered, filters);

  // Re-fetch the extra fields we want in CSV (not on the in-memory rows).
  const idsInOrder = sorted.map((r) => r.id);
  const idToData = new Map(students.map((s) => [s.id, s]));

  const lines: string[] = [];
  lines.push(HEADERS.join(","));
  for (const id of idsInOrder) {
    const s = idToData.get(id);
    const r = sorted.find((x) => x.id === id);
    if (!s || !r) continue;
    lines.push(
      [
        csvCell(s.fullName),
        csvCell(s.email),
        csvCell(s.phone),
        csvCell(s.docType.replace("_", " ").toLowerCase()),
        csvCell(s.docNumber),
        csvCell(s.dob.toISOString().slice(0, 10)),
        csvCell(s.nationality),
        csvCell(s.nif),
        csvCell(s.niss ?? ""),
        csvCell(s.address),
        csvCell(s.city),
        csvCell(r.latestEnrollment?.batchCode ?? ""),
        csvCell(r.latestEnrollment?.status ?? ""),
        csvCell((r.latestEnrollment?.feeCents ?? 0) / 100),
        csvCell(r.paidCents / 100),
        csvCell(r.dueCents / 100),
        csvCell(r.lastPaidAt ? r.lastPaidAt.toISOString().slice(0, 10) : ""),
        csvCell(s.createdAt.toISOString().slice(0, 10)),
      ].join(","),
    );
  }

  const csv = "﻿" + lines.join("\n"); // BOM for Excel UTF-8
  const filename = `students-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
