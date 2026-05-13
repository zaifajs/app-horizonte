import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["TEACHER"]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-zinc-50">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <Link href="/teacher" className="font-semibold tracking-tight">
            Horizonte · Teacher
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              {user.name} ({user.role.toLowerCase()})
            </span>
            <Link href="/logout" className="hover:underline">
              Sign out
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
