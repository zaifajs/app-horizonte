import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">
            Novo Horizonte
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/register" className="hover:underline">
              Inscrever
            </Link>
            <Link href="/login" className="hover:underline">
              Entrar
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl px-4 py-4">
          © Novo Horizonte · Português Língua de Acolhimento
        </div>
      </footer>
    </div>
  );
}
