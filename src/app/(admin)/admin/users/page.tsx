import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { InviteUserDialog } from "./invite-user-dialog";
import { UserActions } from "./user-actions";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export const metadata = { title: "Users · Horizonte CRM" };

const ROLE_CHIP: Record<string, string> = {
  ADMIN: "chip-primary",
  STAFF: "chip-info",
  TEACHER: "chip-accent",
  STUDENT: "chip-muted",
};

export default async function UsersPage() {
  const actor = await requireRole(["ADMIN"]);
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF", "TEACHER"] } },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
  });

  const counts = {
    admin: users.filter((u) => u.role === "ADMIN").length,
    staff: users.filter((u) => u.role === "STAFF").length,
    teacher: users.filter((u) => u.role === "TEACHER").length,
    inactive: users.filter((u) => !u.isActive).length,
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
            Access
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <h1 className="font-display text-4xl font-medium">Users</h1>
            <span className="hz-mono text-base" style={{ color: "var(--hz-ink-3)" }}>
              {users.length} total
            </span>
          </div>
          <div className="mt-1.5 text-sm hz-mono" style={{ color: "var(--hz-ink-2)" }}>
            {counts.admin} admin · {counts.staff} staff · {counts.teacher} teacher
            {counts.inactive > 0 ? ` · ${counts.inactive} inactive` : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <InviteUserDialog />
        </div>
      </section>

      {/* Table */}
      <div className="hz-card overflow-x-auto">        <table className="stbl">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 260 }}>Email</th>
              <th style={{ width: 100 }}>Role</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 130 }}>Joined</th>
              <th style={{ width: 240, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={u.isActive ? undefined : { opacity: 0.6 }}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} />
                    <span className="font-semibold">{u.name}</span>
                    {u.id === actor.id ? (
                      <span className="chip chip-muted">YOU</span>
                    ) : null}
                  </div>
                </td>
                <td className="hz-mono text-sm" style={{ color: "var(--hz-ink-2)" }}>
                  {u.email}
                </td>
                <td>
                  <span className={`chip ${ROLE_CHIP[u.role] ?? "chip-muted"}`}>
                    {u.role.toLowerCase()}
                  </span>
                </td>
                <td>
                  {u.isActive ? (
                    <span className="status-pill" style={{ color: "var(--hz-success)" }}>
                      <span className="dot" style={{ background: "var(--hz-success)" }} />
                      Active
                    </span>
                  ) : (
                    <span className="status-pill" style={{ color: "var(--hz-ink-3)" }}>
                      <span className="dot" style={{ background: "var(--hz-ink-3)" }} />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
                  {format(u.createdAt, "yyyy-MM-dd")}
                </td>
                <td style={{ textAlign: "right" }}>
                  <UserActions
                    user={{
                      id: u.id,
                      name: u.name,
                      role: u.role,
                      isActive: u.isActive,
                    }}
                    isSelf={u.id === actor.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
