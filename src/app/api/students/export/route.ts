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
import {
  EXPORT_COLUMNS,
  parseColsParam,
  type ExportColumnKey,
} from "@/lib/students/export-columns";
import { loadBatchSequence } from "@/lib/students/batch-seq";

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
  const cols = parseColsParam(url.searchParams.get("cols"));
  const where = buildStudentWhere(filters);

  const [students, batchSeq] = await Promise.all([
    prisma.student.findMany({
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
    }),
    loadBatchSequence(),
  ]);

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
            batchSeq: batchSeq.get(enr.id) ?? null,
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
  const idToStudent = new Map(students.map((s) => [s.id, s]));

  const cellsFor = (id: string): Record<ExportColumnKey, string> => {
    const s = idToStudent.get(id)!;
    const r = sorted.find((x) => x.id === id)!;
    return {
      batchSeq: r.latestEnrollment?.batchSeq != null ? String(r.latestEnrollment.batchSeq) : "",
      name: s.fullName,
      email: s.email,
      phone: s.phone,
      docType: s.docType.replace("_", " ").toLowerCase(),
      docNumber: s.docNumber,
      dob: s.dob.toISOString().slice(0, 10),
      nationality: s.nationality,
      nif: s.nif,
      niss: s.niss ?? "",
      address: s.address,
      city: s.city,
      batch: r.latestEnrollment?.batchCode ?? "",
      status: r.latestEnrollment?.status ?? "",
      fee: String((r.latestEnrollment?.feeCents ?? 0) / 100),
      paid: String(r.paidCents / 100),
      due: String(r.dueCents / 100),
      lastPayment: r.lastPaidAt ? r.lastPaidAt.toISOString().slice(0, 10) : "",
      registered: s.createdAt.toISOString().slice(0, 10),
    };
  };

  const labelByKey = new Map(EXPORT_COLUMNS.map((c) => [c.key, c.label]));
  const lines: string[] = [];
  lines.push(cols.map((c) => csvCell(labelByKey.get(c) ?? c)).join(","));
  for (const r of sorted) {
    const cells = cellsFor(r.id);
    lines.push(cols.map((c) => csvCell(cells[c])).join(","));
  }

  const csv = "﻿" + lines.join("\n");
  const filename = `students-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
