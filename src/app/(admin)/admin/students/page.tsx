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

export const dynamic = "force-dynamic";

export const metadata = { title: "Students · Horizonte CRM" };

export default async function StudentsPage() {
  const students = await prisma.student.findMany({
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
          payments: { select: { amountCents: true } },
        },
        orderBy: { enrolledAt: "desc" },
        take: 1,
      },
    },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">
            All registered students. {students.length} shown.
          </p>
        </div>
        <Link href="/admin/students/new">
          <Button>Add student</Button>
        </Link>
      </div>

      {students.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No students yet.{" "}
          <Link href="/admin/students/new" className="underline">
            Add the first one.
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Latest batch</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => {
                const enr = s.enrollments[0];
                const paid = enr?.payments.reduce((a, p) => a + p.amountCents, 0) ?? 0;
                const fee = enr?.batch.course.feeCents ?? 0;
                const due = enr ? Math.max(0, fee - paid) : 0;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/students/${s.id}`} className="hover:underline">
                        {s.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell className="tabular-nums">{s.phone}</TableCell>
                    <TableCell>{s.city}</TableCell>
                    <TableCell>
                      {enr ? (
                        <span className="inline-flex items-center gap-1">
                          {enr.batch.code}
                          <Badge
                            variant="outline"
                            className={
                              enr.status === "PENDING"
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : enr.status === "ACTIVE"
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                  : ""
                            }
                          >
                            {enr.status.toLowerCase()}
                          </Badge>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {enr ? `€${(paid / 100).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {enr ? (
                        due === 0 ? (
                          <span className="text-muted-foreground">€0.00</span>
                        ) : (
                          <span className="text-amber-700 font-medium">
                            €{(due / 100).toFixed(2)}
                          </span>
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{format(s.createdAt, "dd MMM yyyy")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
