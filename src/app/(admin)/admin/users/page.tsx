import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { InviteUserDialog } from "./invite-user-dialog";
import { UserActions } from "./user-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Users · Horizonte CRM" };

export default async function UsersPage() {
  const actor = await requireRole(["ADMIN"]);
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF", "TEACHER"] } },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} admin / staff / teacher accounts.
          </p>
        </div>
        <InviteUserDialog />
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className={u.isActive ? "" : "opacity-60"}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      u.role === "ADMIN"
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : u.role === "STAFF"
                          ? "bg-blue-100 text-blue-900 border-blue-300"
                          : "bg-violet-100 text-violet-900 border-violet-300"
                    }
                  >
                    {u.role.toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.isActive ? (
                    <span className="text-xs text-emerald-700">Active</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Deactivated</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {format(u.createdAt, "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <UserActions
                    user={{
                      id: u.id,
                      name: u.name,
                      role: u.role,
                      isActive: u.isActive,
                    }}
                    isSelf={u.id === actor.id}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
