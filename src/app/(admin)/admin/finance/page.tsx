import Link from "next/link";
import { format, startOfMonth, startOfYear, subDays } from "date-fns";
import { prisma } from "@/lib/db";
import { FinanceFilters } from "./finance-filters";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export const metadata = { title: "Finance · Horizonte CRM" };

// Range presets understood by the ?range query param.
type Range = "all" | "month" | "30d" | "year";

function rangeFromParam(v: string | undefined): Range {
  if (v === "month" || v === "30d" || v === "year") return v;
  return "all";
}

function rangeStart(r: Range): Date | null {
  const today = new Date();
  if (r === "month") return startOfMonth(today);
  if (r === "30d") return subDays(today, 30);
  if (r === "year") return startOfYear(today);
  return null;
}

type StatusFilter = "active" | "all";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const range = rangeFromParam(sp.range);
  const status: StatusFilter = sp.status === "all" ? "all" : "active";
  const since = rangeStart(range);

  // We compute everything in cents server-side to avoid float drift.

  // 1) Pull all batches with their per-student fee + enrolment counts split
  //    by status. The schema doesn't have an enrollment-status group-by
  //    helper, so we fetch and aggregate in TS.
  const batches = await prisma.batch.findMany({
    orderBy: { startDate: "desc" },
    include: {
      course: { select: { code: true, name: true, level: true, feeCents: true } },
      enrollments: {
        select: {
          id: true,
          status: true,
          payments: {
            where: since ? { paidAt: { gte: since } } : undefined,
            select: { amountCents: true, method: true },
          },
        },
      },
    },
  });

  // Per-batch aggregates: collected, outstanding, bank, cash.
  // "Outstanding" by default excludes WITHDRAWN — those are no longer being
  // chased (?status=all flips this on).
  const rows = batches.map((b) => {
    let collectedCents = 0;
    let bankCents = 0;
    let cashCents = 0;
    let chasingEnrollments = 0; // ACTIVE + PENDING (and WITHDRAWN if status=all)
    let totalEnrolled = 0;
    let withdrawnPaidCents = 0;

    for (const e of b.enrollments) {
      totalEnrolled += 1;
      const counts =
        e.status === "ACTIVE" ||
        e.status === "PENDING" ||
        (status === "all" && e.status === "WITHDRAWN");
      if (counts) chasingEnrollments += 1;

      for (const p of e.payments) {
        collectedCents += p.amountCents;
        if (p.method === "BANK") bankCents += p.amountCents;
        else if (p.method === "CASH") cashCents += p.amountCents;
        if (e.status === "WITHDRAWN") withdrawnPaidCents += p.amountCents;
      }
    }

    // Total due against chasing enrollments only (so withdrawn don't inflate
    // the outstanding bill when the default policy is in effect).
    const totalDueCents = chasingEnrollments * b.course.feeCents;
    // Collected by chasing enrollments only — for the Outstanding maths we
    // need to subtract only what those students paid, not what withdrawn
    // students paid in the past.
    const collectedByChasingCents = Math.max(
      0,
      collectedCents - (status === "active" ? withdrawnPaidCents : 0),
    );
    const outstandingCents = Math.max(0, totalDueCents - collectedByChasingCents);
    const pctPaid =
      totalDueCents > 0
        ? Math.min(100, Math.round((collectedByChasingCents / totalDueCents) * 100))
        : 0;

    return {
      id: b.id,
      code: b.code,
      course: b.course,
      startDate: b.startDate,
      totalEnrolled,
      chasingEnrollments,
      feeCents: b.course.feeCents,
      totalDueCents,
      collectedCents,
      bankCents,
      cashCents,
      outstandingCents,
      pctPaid,
      withdrawnPaidCents,
    };
  });

  // Sort: outstanding desc (biggest debts first), then collected desc.
  rows.sort(
    (a, b) =>
      b.outstandingCents - a.outstandingCents ||
      b.collectedCents - a.collectedCents,
  );

  // Top-level KPIs are sums across the rows (after status filter applied).
  const kpi = rows.reduce(
    (acc, r) => ({
      collected: acc.collected + r.collectedCents,
      outstanding: acc.outstanding + r.outstandingCents,
      bank: acc.bank + r.bankCents,
      cash: acc.cash + r.cashCents,
      totalDue: acc.totalDue + r.totalDueCents,
    }),
    { collected: 0, outstanding: 0, bank: 0, cash: 0, totalDue: 0 },
  );
  const overallPct =
    kpi.totalDue > 0 ? Math.min(100, Math.round((kpi.collected / kpi.totalDue) * 100)) : 0;
  const bankShare =
    kpi.collected > 0 ? Math.round((kpi.bank / kpi.collected) * 100) : 0;
  const cashShare = kpi.collected > 0 ? 100 - bankShare : 0;

  return (
    <div className="space-y-5">
      <section className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div
            className="text-xs hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Treasury
          </div>
          <h1
            className="font-display text-4xl font-medium mt-1"
            style={{ color: "var(--hz-ink)" }}
          >
            Finance
          </h1>
          <p
            className="mt-1.5 text-sm hz-mono"
            style={{ color: "var(--hz-ink-2)" }}
          >
            {rows.length} {rows.length === 1 ? "batch" : "batches"} ·{" "}
            {since ? `since ${format(since, "dd MMM yyyy")}` : "all time"} ·{" "}
            {status === "active"
              ? "active + pending enrolments"
              : "all enrolments (incl. withdrawn)"}
          </p>
        </div>
      </section>

      <FinanceFilters currentRange={range} currentStatus={status} />

      {/* KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Collected"
          value={eur(kpi.collected)}
          sub={`${overallPct}% of ${eur(kpi.totalDue)} due`}
          progress={{ pct: overallPct, color: "var(--hz-success)" }}
          tone="success"
        />
        <KpiTile
          label="Outstanding"
          value={eur(kpi.outstanding)}
          sub={`${100 - overallPct}% to collect`}
          tone={kpi.outstanding > 0 ? "danger" : "muted"}
        />
        <KpiTile
          label="Bank"
          value={eur(kpi.bank)}
          sub={`${bankShare}% of collected`}
          progress={{ pct: bankShare, color: "var(--hz-info)" }}
        />
        <KpiTile
          label="Cash"
          value={eur(kpi.cash)}
          sub={`${cashShare}% of collected`}
          progress={{ pct: cashShare, color: "var(--hz-warning)" }}
        />
      </section>

      {/* Per-batch table */}
      <section className="hz-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="stbl w-full text-sm">
            <thead>
              <tr>
                <th>Batch</th>
                <th className="hidden md:table-cell">Enrolled</th>
                <th>Total due</th>
                <th>Collected</th>
                <th>Outstanding</th>
                <th className="hidden lg:table-cell">Bank</th>
                <th className="hidden lg:table-cell">Cash</th>
                <th style={{ width: 120 }}>% paid</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                    No batches yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.code} tone="primary" />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/batches/${r.id}`}
                            className="font-semibold hover:underline"
                            style={{ color: "var(--hz-primary)" }}
                          >
                            {r.code}
                          </Link>
                          <div className="text-xs hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                            {r.course.code} · {r.course.level}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <div className="hz-mono text-sm">
                        {r.chasingEnrollments}
                        {r.totalEnrolled !== r.chasingEnrollments ? (
                          <span style={{ color: "var(--hz-ink-3)" }}>
                            {" "}
                            / {r.totalEnrolled}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                        {eur(r.feeCents)} fee
                      </div>
                    </td>
                    <td className="hz-mono">{eur(r.totalDueCents)}</td>
                    <td className="hz-mono" style={{ color: "var(--hz-success)" }}>
                      {eur(r.collectedCents)}
                    </td>
                    <td
                      className="hz-mono"
                      style={{
                        color:
                          r.outstandingCents > 0
                            ? "var(--hz-danger)"
                            : "var(--hz-ink-3)",
                      }}
                    >
                      {eur(r.outstandingCents)}
                    </td>
                    <td className="hidden lg:table-cell hz-mono" style={{ color: "var(--hz-info)" }}>
                      {eur(r.bankCents)}
                    </td>
                    <td className="hidden lg:table-cell hz-mono" style={{ color: "var(--hz-warning)" }}>
                      {eur(r.cashCents)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="pbar flex-1">
                          <span
                            style={{
                              width: `${r.pctPaid}%`,
                              background:
                                r.pctPaid >= 100
                                  ? "var(--hz-success)"
                                  : "var(--hz-primary)",
                            }}
                          />
                        </div>
                        <span
                          className="hz-mono text-xs tabular-nums"
                          style={{ color: "var(--hz-ink-2)" }}
                        >
                          {r.pctPaid}%
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/admin/students?batch=${encodeURIComponent(r.code)}&paid=overdue`}
                        className="ibtn"
                        title="Open the unpaid roster for this batch"
                        aria-label={`Open unpaid roster for ${r.code}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
        Outstanding excludes withdrawn students by default. Switch the status
        filter to "All" to include them. Payment amounts in EUR; the schema
        carries a per-payment currency column for future multi-currency.
      </p>
    </div>
  );
}

function eur(cents: number): string {
  return `€${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function KpiTile({
  label,
  value,
  sub,
  progress,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  progress?: { pct: number; color: string };
  tone?: "success" | "danger" | "muted";
}) {
  const toneColor =
    tone === "success"
      ? "var(--hz-success)"
      : tone === "danger"
        ? "var(--hz-danger)"
        : "var(--hz-ink)";
  return (
    <div className="hz-card p-3">
      <div
        className="text-xs hz-mono uppercase tracking-[.16em]"
        style={{ color: "var(--hz-ink-3)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 stat-num"
        style={{
          color: toneColor,
          fontSize: "1.5rem",
          fontFamily: "var(--font-display)",
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-xs hz-mono" style={{ color: "var(--hz-ink-3)" }}>
          {sub}
        </div>
      ) : null}
      {progress ? (
        <div className="pbar mt-2">
          <span style={{ width: `${progress.pct}%`, background: progress.color }} />
        </div>
      ) : null}
    </div>
  );
}
