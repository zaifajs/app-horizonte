// Parse + apply student-list filters from URL search params.
//
// Filters: batch, enrollmentStatus, paymentProgress, q (free text search),
// paidFrom / paidTo (last payment date range), sort, dir.

import type { Prisma } from "@prisma/client";

export type EnrollmentStatus = "PENDING" | "ACTIVE" | "WITHDRAWN" | "COMPLETED";
export type PaymentProgress = "unpaid" | "partial" | "full";

// Time + money combined → one actionable label.
export type Urgency =
  | "paid"        // green   — fully paid
  | "partial"     // yellow  — class started, partial paid, deadline > 7d away
  | "due_soon"    // amber   — class started, not full, ≤7d to deadline
  | "overdue"     // red     — class started, unpaid or past deadline
  | "pre_start"   // neutral — class hasn't started yet
  | "withdrawn";  // dimmed  — explicit withdrawal

export const PAYMENT_DEADLINE_DAYS = 28; // 4 weeks from class start
export const DUE_SOON_WINDOW_DAYS = 7;

export type StudentFilters = {
  batch: string | null;
  enrollmentStatus: EnrollmentStatus | null;
  paymentProgress: PaymentProgress | null;
  urgency: Urgency | null;
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
    | "lastPaid"
    // Group-by-urgency-tier so rows with the same payment status sit
    // together (overdue / partial / due_soon / pre_start / paid /
    // withdrawn). Used by the Payment column header.
    | "payment";
  dir: "asc" | "desc";
};

export const defaultFilters: StudentFilters = {
  batch: null,
  enrollmentStatus: null,
  paymentProgress: null,
  urgency: null,
  q: null,
  paidFrom: null,
  paidTo: null,
  sort: "batch",
  dir: "desc",
};

const URGENCY_VALUES: Urgency[] = [
  "paid", "partial", "due_soon", "overdue", "pre_start", "withdrawn",
];

const SORT_VALUES = ["registered", "name", "batch", "batchSeq", "paid", "due", "lastPaid", "payment"] as const;

// Order used by sort="payment". Lower rank = more actionable, so asc lands
// overdue-first (matches SortableHeader's first-click default direction).
// Secondary ordering inside a tier is daysToDeadline asc so the closest
// dunning lands at the very top.
const URGENCY_RANK: Record<string, number> = {
  overdue: 0,
  partial: 1,
  due_soon: 2,
  pre_start: 3,
  paid: 4,
  withdrawn: 5,
};
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
  const sort = (get("sort") ?? "batch") as StudentFilters["sort"];
  const dir = (get("dir") ?? "desc") as StudentFilters["dir"];
  const enrollmentStatus = get("status") as EnrollmentStatus | null;
  const paymentProgress = get("paid") as PaymentProgress | null;
  const urgency = get("urgency") as Urgency | null;

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
    urgency:
      urgency && URGENCY_VALUES.includes(urgency) ? urgency : null,
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
    batchStartDate: Date | null;
    batchSeq: number | null;
    enrolledAt: Date;
    feeCents: number;
  } | null;
  paidCents: number;
  dueCents: number;
  lastPaidAt: Date | null;
  paymentProgress: PaymentProgress;
  urgency: Urgency;
  /** Whole days from today to the payment deadline. Negative = past. Null = no enrollment / pre-start. */
  daysToDeadline: number | null;
};

export function progressOf(paid: number, fee: number): PaymentProgress {
  if (paid <= 0) return "unpaid";
  if (paid >= fee) return "full";
  return "partial";
}

/** Compute the action-needed state for a row. */
export function computeUrgency({
  enrollmentStatus,
  batchStartDate,
  paidCents,
  feeCents,
  today,
}: {
  enrollmentStatus: EnrollmentStatus | null;
  batchStartDate: Date | null;
  paidCents: number;
  feeCents: number;
  today: Date;
}): { urgency: Urgency; daysToDeadline: number | null } {
  if (enrollmentStatus === "WITHDRAWN") {
    return { urgency: "withdrawn", daysToDeadline: null };
  }
  if (feeCents > 0 && paidCents >= feeCents) {
    return { urgency: "paid", daysToDeadline: null };
  }

  // Compute deadline only if we have a batch start date.
  let daysToDeadline: number | null = null;
  let classStarted = false;
  if (batchStartDate) {
    const dayMs = 86_400_000;
    const startMs = Date.UTC(
      batchStartDate.getUTCFullYear(),
      batchStartDate.getUTCMonth(),
      batchStartDate.getUTCDate(),
    );
    const todayMs = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    classStarted = todayMs >= startMs;
    const deadlineMs = startMs + PAYMENT_DEADLINE_DAYS * dayMs;
    daysToDeadline = Math.round((deadlineMs - todayMs) / dayMs);
  }

  // Any money received → partial track. Deadline only escalates to
  // due_soon / overdue once the class is running.
  if (paidCents > 0) {
    if (classStarted && daysToDeadline !== null) {
      if (daysToDeadline < 0) return { urgency: "overdue", daysToDeadline };
      if (daysToDeadline <= DUE_SOON_WINDOW_DAYS) return { urgency: "due_soon", daysToDeadline };
    }
    return { urgency: "partial", daysToDeadline };
  }

  // Zero received.
  if (classStarted) {
    return { urgency: "overdue", daysToDeadline };
  }
  return { urgency: "pre_start", daysToDeadline };
}

export function applyComputedFilters(
  rows: StudentRow[],
  f: StudentFilters,
): StudentRow[] {
  let result = rows;
  if (f.urgency) {
    result = result.filter((r) => r.urgency === f.urgency);
  }
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
      // Primary: batch start date. Secondary (same batch): enrolledAt asc so
      // the registration sequence within a batch reads top→bottom naturally.
      out.sort((a, b) => {
        const aDate = a.latestEnrollment?.batchStartDate?.getTime() ?? null;
        const bDate = b.latestEnrollment?.batchStartDate?.getTime() ?? null;
        const primary = dir * cmp(aDate, bDate);
        if (primary !== 0) return primary;
        return cmp(a.latestEnrollment?.enrolledAt.getTime() ?? null, b.latestEnrollment?.enrolledAt.getTime() ?? null);
      });
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
    case "payment":
      // Primary: urgency tier rank. Secondary (same tier): daysToDeadline
      // asc so the closest dunning surfaces first within an "overdue" cluster.
      // Tertiary: dueCents desc so bigger debts beat smaller ones at a tie.
      out.sort((a, b) => {
        const aRank = URGENCY_RANK[a.urgency] ?? 99;
        const bRank = URGENCY_RANK[b.urgency] ?? 99;
        const primary = dir * cmp(aRank, bRank);
        if (primary !== 0) return primary;
        const aDays = a.daysToDeadline ?? null;
        const bDays = b.daysToDeadline ?? null;
        const secondary = cmp(aDays, bDays);
        if (secondary !== 0) return secondary;
        return cmp(b.dueCents, a.dueCents);
      });
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
  add("urgency", patch.urgency !== undefined ? (patch.urgency as string | null) : current.urgency);
  add("paidFrom", patch.paidFrom !== undefined ? patch.paidFrom : current.paidFrom);
  add("paidTo", patch.paidTo !== undefined ? patch.paidTo : current.paidTo);
  const sort = patch.sort !== undefined ? patch.sort : current.sort;
  const dir = patch.dir !== undefined ? patch.dir : current.dir;
  if (sort && sort !== "batch") add("sort", sort);
  if (dir && dir !== "desc") add("dir", dir);
  const params = new URLSearchParams(merged);
  const s = params.toString();
  return s ? `?${s}` : "";
}
