import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["ADMIN", "STAFF"]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-zinc-50 print:hidden">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link href="/admin/today" className="font-semibold tracking-tight">
            Horizonte CRM
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin/today" className="hover:underline">
              Today
            </Link>
            <Link href="/admin/students" className="hover:underline">
              Students
            </Link>
            <Link href="/admin/batches" className="hover:underline">
              Batches
            </Link>
            {user.role === "ADMIN" ? (
              <Link href="/admin/users" className="hover:underline">
                Users
              </Link>
            ) : null}
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {user.name} ({user.role.toLowerCase()})
            </span>
            <Link href="/logout" className="hover:underline">
              Sign out
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        {children}
      </main>
    </div>
  );
}
