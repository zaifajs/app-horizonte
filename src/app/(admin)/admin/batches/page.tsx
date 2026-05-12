import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Batches · Horizonte CRM",
};

export default async function BatchesPage() {
  const batches = await prisma.batch.findMany({
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: {
      course: { select: { code: true, name: true } },
      trainer: { select: { name: true } },
      _count: { select: { enrollments: true, sessions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
          <p className="text-sm text-muted-foreground">
            Active and upcoming turmas.
          </p>
        </div>
        <Link href="/admin/batches/new">
          <Button>New batch</Button>
        </Link>
      </div>

      {batches.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No batches yet.{" "}
          <Link href="/admin/batches/new" className="underline">
            Create the first one.
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Trainer</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/batches/${b.id}`} className="hover:underline">
                      {b.code}
                    </Link>
                  </TableCell>
                  <TableCell>{b.course.code}</TableCell>
                  <TableCell>{format(b.startDate, "dd MMM yyyy")}</TableCell>
                  <TableCell>{b.startTime}</TableCell>
                  <TableCell>{b.trainer?.name ?? "—"}</TableCell>
                  <TableCell>{b.capacity}</TableCell>
                  <TableCell>{b._count.enrollments}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{b.status.toLowerCase()}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
