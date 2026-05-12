import Link from "next/link";

// Auth gate is wired in Task 1.9 (Supabase middleware).
// For now this is a layout shell only.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-zinc-50">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link href="/admin/today" className="font-semibold tracking-tight">
            Horizonte CRM
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin/today" className="hover:underline">
              Hoje
            </Link>
            <Link href="/admin/students" className="hover:underline">
              Estudantes
            </Link>
            <Link href="/admin/batches" className="hover:underline">
              Turmas
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
