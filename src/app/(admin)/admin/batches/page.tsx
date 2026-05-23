import Link from "next/link";
import { format, startOfToday, differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export const metadata = { title: "Batches · Horizonte CRM" };

type StatusFilter = "ALL" | "ACTIVE" | "UPCOMING" | "FINISHED";

function parseStatus(v: string | undefined): StatusFilter {
  if (v === "ACTIVE" || v === "UPCOMING" || v === "FINISHED") return v;
  return "ALL";
}

function relativeDate(start: Date, today: Date): string {
  const diff = differenceInCalendarDays(start, today);
  if (diff === 0) return "today";
  if (diff > 0) return `in ${diff} ${diff === 1 ? "day" : "days"}`;
  const abs = Math.abs(diff);
  return `${abs} ${abs === 1 ? "day" : "days"} ago`;
}

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = parseStatus(sp.status);
  const q = (sp.q ?? "").trim().toLowerCase();
  const today = startOfToday();

  const all = await prisma.batch.findMany({
    orderBy: [{ startDate: "desc" }],
    include: {
      course: { select: { code: true, name: true, level: true } },
      trainer: { select: { id: true, name: true } },
      enrollments: { select: { status: true } },
    },
  });

  // Derive a runtime status: ACTIVE (startDate <= today, not finished) /
  // UPCOMING (future startDate) / FINISHED (status=FINISHED or
  // CANCELLED). Mirrors the dashboard logic so the labels match.
  type Row = (typeof all)[number] & {
    runtimeStatus: StatusFilter;
    enrolledCount: number;
  };
  const rows: Row[] = all.map((b) => {
    let s: StatusFilter;
    if (b.status === "FINISHED" || b.status === "CANCELLED") s = "FINISHED";
    else if (b.startDate <= today) s = "ACTIVE";
    else s = "UPCOMING";
    const enrolledCount = b.enrollments.filter(
      (e) => e.status === "ACTIVE" || e.status === "PENDING",
    ).length;
    return { ...b, runtimeStatus: s, enrolledCount };
  });

  const counts = {
    ALL: rows.length,
    ACTIVE: rows.filter((r) => r.runtimeStatus === "ACTIVE").length,
    UPCOMING: rows.filter((r) => r.runtimeStatus === "UPCOMING").length,
    FINISHED: rows.filter((r) => r.runtimeStatus === "FINISHED").length,
  } satisfies Record<StatusFilter, number>;

  let filtered = rows;
  if (statusFilter !== "ALL") {
    filtered = filtered.filter((r) => r.runtimeStatus === statusFilter);
  }
  if (q.length > 0) {
    filtered = filtered.filter((r) => {
      const hay = [
        r.code,
        r.course.code,
        r.course.name,
        r.trainer?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const segHref = (s: StatusFilter) => {
    const params = new URLSearchParams();
    if (s !== "ALL") params.set("status", s);
    if (q.length > 0) params.set("q", q);
    const qs = params.toString();
    return qs ? `/admin/batches?${qs}` : "/admin/batches";
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div
            className="text-sm hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Cronograma
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <h1 className="font-display text-4xl font-medium">Batches</h1>
            <span className="hz-mono text-base" style={{ color: "var(--hz-ink-3)" }}>
              {counts.ALL} total
            </span>
          </div>
          <div className="mt-1.5 text-sm hz-mono" style={{ color: "var(--hz-ink-2)" }}>
            {counts.ACTIVE} active · {counts.UPCOMING} upcoming · {counts.FINISHED}{" "}
            finished
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/admin/batches/new" className="btn-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            New batch
          </Link>
        </div>
      </section>

      {/* Status segments + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="seg">
          <Link href={segHref("ALL")} className={statusFilter === "ALL" ? "on" : ""}>
            All <span className="ct">{counts.ALL}</span>
          </Link>
          <Link href={segHref("ACTIVE")} className={statusFilter === "ACTIVE" ? "on" : ""}>
            <span className="dot" style={{ background: "var(--hz-success)" }} />
            Active <span className="ct">{counts.ACTIVE}</span>
          </Link>
          <Link
            href={segHref("UPCOMING")}
            className={statusFilter === "UPCOMING" ? "on" : ""}
          >
            <span className="dot" style={{ background: "var(--hz-warning)" }} />
            Upcoming <span className="ct">{counts.UPCOMING}</span>
          </Link>
          <Link
            href={segHref("FINISHED")}
            className={statusFilter === "FINISHED" ? "on" : ""}
          >
            <span className="dot" style={{ background: "var(--hz-ink-3)" }} />
            Finished <span className="ct">{counts.FINISHED}</span>
          </Link>
        </div>
        <form
          action="/admin/batches"
          method="get"
          className="ml-auto"
          style={{ minWidth: 280 }}
        >
          {statusFilter !== "ALL" ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          <label className="inp" style={{ minWidth: 280 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--hz-ink-3)" }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              name="q"
              placeholder="Search code, course, trainer…"
              defaultValue={q}
            />
          </label>
        </form>
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-12 text-center hz-mono text-sm"
          style={{ color: "var(--hz-ink-3)", borderColor: "var(--hz-line)" }}
        >
          {rows.length === 0 ? (
            <>
              No batches yet.{" "}
              <Link href="/admin/batches/new" className="underline">
                Create the first one.
              </Link>
            </>
          ) : (
            "No batches match these filters."
          )}
        </div>
      ) : (
        <div className="hz-card overflow-x-auto">          <table className="stbl">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Code</th>
                <th>Course</th>
                <th style={{ width: 220 }}>Trainer</th>
                <th style={{ width: 150 }}>Starts</th>
                <th style={{ width: 220 }}>Enrolled</th>
                <th style={{ width: 130 }}>Status</th>
                <th style={{ width: 80, textAlign: "right" }}>Open</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const isFinished = b.runtimeStatus === "FINISHED";
                const enrolledPct = Math.min(
                  100,
                  Math.round((b.enrolledCount / Math.max(1, b.capacity)) * 100),
                );
                const fillColor =
                  enrolledPct >= 80
                    ? "var(--hz-success)"
                    : enrolledPct >= 30
                      ? "var(--hz-primary)"
                      : "var(--hz-warning)";
                const statusMeta = {
                  ACTIVE: { color: "var(--hz-success)", label: "Active" },
                  UPCOMING: { color: "var(--hz-warning)", label: "Upcoming" },
                  FINISHED: { color: "var(--hz-ink-3)", label: "Finished" },
                  ALL: { color: "var(--hz-ink-3)", label: "—" },
                }[b.runtimeStatus];
                return (
                  <tr key={b.id} style={isFinished ? { opacity: 0.7 } : undefined}>
                    <td>
                      <Link
                        href={`/admin/batches/${b.id}`}
                        className="hz-mono text-base font-semibold"
                        style={{
                          color: isFinished ? "var(--hz-ink-2)" : "var(--hz-primary)",
                        }}
                      >
                        {b.code}
                      </Link>
                    </td>
                    <td>
                      <div
                        className="font-medium"
                        style={isFinished ? { color: "var(--hz-ink-2)" } : undefined}
                      >
                        {b.course.code} <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>· {b.course.level}</span>
                      </div>
                      <div
                        className="text-xs hz-mono truncate"
                        style={{ color: "var(--hz-ink-3)", maxWidth: 220 }}
                        title={b.course.name}
                      >
                        {b.course.name}
                      </div>
                    </td>
                    <td>
                      {b.trainer ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={b.trainer.name} size={24} fontSize="0.7rem" />
                          <span style={isFinished ? { color: "var(--hz-ink-2)" } : undefined}>
                            {b.trainer.name}
                          </span>
                        </div>
                      ) : (
                        <Link
                          href={`/admin/batches/${b.id}`}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm"
                          style={{
                            border: "1px dashed var(--hz-line)",
                            color: "var(--hz-warning)",
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <line x1="22" y1="11" x2="16" y2="11" />
                            <line x1="19" y1="8" x2="19" y2="14" />
                          </svg>
                          Assign trainer
                        </Link>
                      )}
                    </td>
                    <td>
                      <div className="hz-mono text-sm">
                        {format(b.startDate, "yyyy-MM-dd")}
                      </div>
                      <div className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
                        {format(b.startDate, "EEE")} · {relativeDate(b.startDate, today)}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-baseline gap-2">
                        <span className="hz-mono text-base font-semibold">
                          {b.enrolledCount}
                        </span>
                        <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
                          / {b.capacity}
                        </span>
                      </div>
                      <div className="pbar mt-1.5" style={{ width: 160 }}>
                        <span style={{ width: `${enrolledPct}%`, background: fillColor }} />
                      </div>
                    </td>
                    <td>
                      <span className="status-pill" style={{ color: statusMeta.color }}>
                        <span className="dot" style={{ background: statusMeta.color }} />
                        {statusMeta.label}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link href={`/admin/batches/${b.id}`} className="ibtn" title="Open">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
