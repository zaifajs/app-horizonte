import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfToday } from "date-fns";
import { computeUrgency } from "@/lib/students/filters";
import { Sidebar } from "./_components/sidebar";
import { TopBar } from "./_components/top-bar";
import { MobileNav } from "./_components/mobile-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["ADMIN", "STAFF"]);

  // Sidebar counts + pinned batches. Kept light: each query is small and
  // indexed; the layout runs server-side on every admin route.
  const today = startOfToday();
  const [openEnrollments, activeStudentCount, activeBatchCount, pinnedBatches] =
    await Promise.all([
      prisma.enrollment.findMany({
        where: { status: { in: ["PENDING", "ACTIVE"] } },
        select: {
          status: true,
          batch: {
            select: {
              startDate: true,
              course: { select: { feeCents: true } },
            },
          },
          payments: { select: { amountCents: true } },
        },
      }),
      prisma.enrollment.count({ where: { status: "ACTIVE" } }),
      prisma.batch.count({
        where: { status: { notIn: ["FINISHED", "CANCELLED"] }, startDate: { lte: today } },
      }),
      prisma.batch.findMany({
        where: { status: { notIn: ["FINISHED", "CANCELLED"] } },
        select: {
          id: true,
          code: true,
          status: true,
          startDate: true,
          course: { select: { code: true } },
          trainer: { select: { name: true } },
        },
        orderBy: { startDate: "asc" },
        take: 3,
      }),
    ]);

  const urgentCount = openEnrollments.reduce((n, e) => {
    const paid = e.payments.reduce((a, p) => a + p.amountCents, 0);
    const fee = e.batch.course.feeCents;
    const u = computeUrgency({
      enrollmentStatus: e.status,
      batchStartDate: e.batch.startDate,
      paidCents: paid,
      feeCents: fee,
      today,
    });
    return u.urgency === "overdue" ? n + 1 : n;
  }, 0);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--hz-bg)" }}>
      <Sidebar
        user={{ name: user.name, role: user.role }}
        counts={{
          urgent: urgentCount,
          students: activeStudentCount,
          batches: activeBatchCount,
        }}
        pinnedBatches={pinnedBatches.map((b) => ({
          id: b.id,
          code: b.code,
          // Derive runtime "active vs upcoming" from start date so manually-
          // stale Batch.status values don't mislabel a running batch.
          status: b.startDate <= today ? "ACTIVE" : "UPCOMING",
          subtitle: `${b.course.code} · ${b.trainer?.name ?? "unassigned"}`,
        }))}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 w-full pb-24 lg:pb-7 print:px-0 print:py-0">
          {children}
        </div>
      </main>

      <MobileNav isAdmin={user.role === "ADMIN"} urgentCount={urgentCount} />
    </div>
  );
}
