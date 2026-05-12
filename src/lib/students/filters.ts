// Parse + apply student-list filters from URL search params.
//
// Filters: batch, enrollmentStatus, paymentProgress, q (free text search),
// paidFrom / paidTo (last payment date range), sort, dir.

import type { Prisma } from "@prisma/client";

export type EnrollmentStatus = "PENDING" | "ACTIVE" | "WITHDRAWN" | "COMPLETED";
export type PaymentProgress = "unpaid" | "partial" | "full";

export type StudentFilters = {
  batch: string | null;
  enrollmentStatus: EnrollmentStatus | null;
  paymentProgress: PaymentProgress | null;
  q: string | null;
  paidFrom: string | null; // YYYY-MM-DD
  paidTo: string | null;
  sort:
    | "registered"
    | "name"
    | "batch"
    | "batchSeq"
    | "paid"
    | "due"
    | "lastPaid";
  dir: "asc" | "desc";
};

export const defaultFilters: StudentFilters = {
  batch: null,
  enrollmentStatus: null,
  paymentProgress: null,
  q: null,
  paidFrom: null,
  paidTo: null,
  sort: "registered",
  dir: "desc",
};

const SORT_VALUES = ["registered", "name", "batch", "batchSeq", "paid", "due", "lastPaid"] as const;
const STATUS_VALUES: EnrollmentStatus[] = ["PENDING", "ACTIVE", "WITHDRAWN", "COMPLETED"];
const PROGRESS_VALUES: PaymentProgress[] = ["unpaid", "partial", "full"];

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): StudentFilters {
  const get = (k: string): string | null => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };
  const sort = (get("sort") ?? "registered") as StudentFilters["sort"];
  const dir = (get("dir") ?? "desc") as StudentFilters["dir"];
  const enrollmentStatus = get("status") as EnrollmentStatus | null;
  const paymentProgress = get("paid") as PaymentProgress | null;

  return {
    batch: get("batch"),
    enrollmentStatus:
      enrollmentStatus && STATUS_VALUES.includes(enrollmentStatus)
        ? enrollmentStatus
        : null,
    paymentProgress:
      paymentProgress && PROGRESS_VALUES.includes(paymentProgress)
        ? paymentProgress
        : null,
    q: (get("q") ?? "").trim() || null,
    paidFrom: get("paidFrom") || null,
    paidTo: get("paidTo") || null,
    sort: (SORT_VALUES as readonly string[]).includes(sort) ? sort : "registered",
    dir: dir === "asc" ? "asc" : "desc",
  };
}

/** Build the Prisma `where` for the Student table. Computed
 *  paid/due filters are NOT done here — applied in JS after the
 *  fetch since they require summing per-enrollment payments. */
export function buildStudentWhere(f: StudentFilters): Prisma.StudentWhereInput {
  const where: Prisma.StudentWhereInput = {};

  if (f.q) {
    where.OR = [
      { fullName: { contains: f.q, mode: "insensitive" } },
      { email: { contains: f.q, mode: "insensitive" } },
      { phone: { contains: f.q } },
      { nif: { contains: f.q } },
      { docNumber: { contains: f.q } },
      { city: { contains: f.q, mode: "insensitive" } },
    ];
  }

  if (f.batch || f.enrollmentStatus) {
    where.enrollments = {
      some: {
        ...(f.batch ? { batch: { code: f.batch } } : {}),
        ...(f.enrollmentStatus ? { status: f.enrollmentStatus } : {}),
      },
    };
  }

  return where;
}

/** Compute paid/due/lastPaidAt per student given the joined payments. */
export type StudentRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  createdAt: Date;
  latestEnrollment: {
    id: string;
    status: EnrollmentStatus;
    batchCode: string;
    batchSeq: number | null;
    feeCents: number;
  } | null;
  paidCents: number;
  dueCents: number;
  lastPaidAt: Date | null;
  paymentProgress: PaymentProgress;
};

export function progressOf(paid: number, fee: number): PaymentProgress {
  if (paid <= 0) return "unpaid";
  if (paid >= fee) return "full";
  return "partial";
}

export function applyComputedFilters(
  rows: StudentRow[],
  f: StudentFilters,
): StudentRow[] {
  let result = rows;
  if (f.paymentProgress) {
    result = result.filter((r) => r.paymentProgress === f.paymentProgress);
  }
  if (f.paidFrom || f.paidTo) {
    const fromMs = f.paidFrom ? Date.parse(`${f.paidFrom}T00:00:00Z`) : null;
    const toMs = f.paidTo ? Date.parse(`${f.paidTo}T23:59:59Z`) : null;
    result = result.filter((r) => {
      if (!r.lastPaidAt) return false;
      const t = r.lastPaidAt.getTime();
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t > toMs) return false;
      return true;
    });
  }
  return result;
}

export function sortRows(rows: StudentRow[], f: StudentFilters): StudentRow[] {
  const dir = f.dir === "asc" ? 1 : -1;
  const out = [...rows];
  const cmp = (a: number | string | null, b: number | string | null) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a < b ? -1 : a > b ? 1 : 0;
  };
  switch (f.sort) {
    case "name":
      out.sort((a, b) => dir * cmp(a.fullName, b.fullName));
      break;
    case "batch":
      out.sort((a, b) => dir * cmp(a.latestEnrollment?.batchCode ?? null, b.latestEnrollment?.batchCode ?? null));
      break;
    case "batchSeq":
      out.sort((a, b) => dir * cmp(a.latestEnrollment?.batchSeq ?? null, b.latestEnrollment?.batchSeq ?? null));
      break;
    case "paid":
      out.sort((a, b) => dir * cmp(a.paidCents, b.paidCents));
      break;
    case "due":
      out.sort((a, b) => dir * cmp(a.dueCents, b.dueCents));
      break;
    case "lastPaid":
      out.sort((a, b) =>
        dir * cmp(a.lastPaidAt?.getTime() ?? null, b.lastPaidAt?.getTime() ?? null),
      );
      break;
    case "registered":
    default:
      out.sort((a, b) => dir * cmp(a.createdAt.getTime(), b.createdAt.getTime()));
  }
  return out;
}

export function filtersToSearchString(
  current: StudentFilters,
  patch: Partial<StudentFilters> & Record<string, string | null | undefined>,
): string {
  const merged: Record<string, string> = {};
  const add = (k: string, v: string | null | undefined) => {
    if (v && String(v).length > 0) merged[k] = String(v);
  };
  add("q", patch.q !== undefined ? patch.q : current.q);
  add("batch", patch.batch !== undefined ? patch.batch : current.batch);
  add("status", patch.enrollmentStatus !== undefined ? patch.enrollmentStatus : current.enrollmentStatus);
  add("paid", patch.paymentProgress !== undefined ? patch.paymentProgress : current.paymentProgress);
  add("paidFrom", patch.paidFrom !== undefined ? patch.paidFrom : current.paidFrom);
  add("paidTo", patch.paidTo !== undefined ? patch.paidTo : current.paidTo);
  const sort = patch.sort !== undefined ? patch.sort : current.sort;
  const dir = patch.dir !== undefined ? patch.dir : current.dir;
  if (sort && sort !== "registered") add("sort", sort);
  if (dir && dir !== "desc") add("dir", dir);
  const params = new URLSearchParams(merged);
  const s = params.toString();
  return s ? `?${s}` : "";
}
