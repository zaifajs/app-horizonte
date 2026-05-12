import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import {
  applyComputedFilters,
  buildStudentWhere,
  filtersToSearchString,
  parseFilters,
  progressOf,
  sortRows,
  type StudentRow,
} from "@/lib/students/filters";
import { StudentsFilters } from "./filters";
import { SavedViews } from "./saved-views";
import { ExportDialog } from "./export-dialog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Students · Horizonte CRM" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const where = buildStudentWhere(filters);

  const [studentsRaw, batches] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        enrollments: {
          include: {
            batch: {
              select: {
                code: true,
                course: { select: { feeCents: true } },
              },
            },
            payments: { select: { amountCents: true, paidAt: true } },
          },
          orderBy: { enrolledAt: "desc" },
        },
      },
      take: 500,
    }),
    prisma.batch.findMany({ orderBy: { startDate: "desc" }, select: { code: true } }),
  ]);

  // Build rows + compute paid/due/lastPaid.
  const rows: StudentRow[] = studentsRaw.map((s) => {
    const enr = s.enrollments[0] ?? null;
    const paid = enr?.payments.reduce((a, p) => a + p.amountCents, 0) ?? 0;
    const fee = enr?.batch.course.feeCents ?? 0;
    const due = enr ? Math.max(0, fee - paid) : 0;
    const lastPaidAt = enr && enr.payments.length > 0
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">
            {sorted.length} of {rows.length} students shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDialog />
          <Link href="/admin/students/new">
            <Button>Add student</Button>
          </Link>
        </div>
      </div>

      <SavedViews />
      <StudentsFilters
        batches={batches}
        initial={{
          q: filters.q ?? "",
          batch: filters.batch ?? "",
          status: filters.enrollmentStatus ?? "",
          paid: filters.paymentProgress ?? "",
          paidFrom: filters.paidFrom ?? "",
          paidTo: filters.paidTo ?? "",
        }}
      />

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No students match these filters.
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader filters={filters} sort="name">Name</SortableHeader>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <SortableHeader filters={filters} sort="batch">Batch</SortableHeader>
                <SortableHeader filters={filters} sort="paid" align="right">Paid</SortableHeader>
                <SortableHeader filters={filters} sort="due" align="right">Due</SortableHeader>
                <SortableHeader filters={filters} sort="lastPaid">Last paid</SortableHeader>
                <SortableHeader filters={filters} sort="registered">Registered</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/students/${r.id}`} className="hover:underline">
                      {r.fullName}
                    </Link>
                  </TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell className="tabular-nums">{r.phone}</TableCell>
                  <TableCell>
                    {r.latestEnrollment ? (
                      <span className="inline-flex items-center gap-1">
                        {r.latestEnrollment.batchCode}
                        <Badge
                          variant="outline"
                          className={
                            r.latestEnrollment.status === "PENDING"
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : r.latestEnrollment.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                : ""
                          }
                        >
                          {r.latestEnrollment.status.toLowerCase()}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    €{(r.paidCents / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.dueCents === 0 ? (
                      <span className="text-muted-foreground">€0.00</span>
                    ) : (
                      <span className="text-amber-700 font-medium">
                        €{(r.dueCents / 100).toFixed(2)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.lastPaidAt ? format(r.lastPaidAt, "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>{format(r.createdAt, "dd MMM yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SortableHeader({
  filters,
  sort,
  align,
  children,
}: {
  filters: ReturnType<typeof parseFilters>;
  sort: "name" | "batch" | "paid" | "due" | "lastPaid" | "registered";
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const isActive = filters.sort === sort;
  const nextDir = isActive && filters.dir === "asc" ? "desc" : "asc";
  const href = `/admin/students${filtersToSearchString(filters, { sort, dir: nextDir })}`;
  const arrow = isActive ? (filters.dir === "asc" ? "↑" : "↓") : "";
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <Link
        href={href}
        className={`inline-flex items-center gap-1 hover:underline ${
          isActive ? "text-foreground font-medium" : ""
        }`}
      >
        {children}
        <span className="text-muted-foreground">{arrow}</span>
      </Link>
    </TableHead>
  );
}
