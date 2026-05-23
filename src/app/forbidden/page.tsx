import Link from "next/link";

export const metadata = {
  title: "Forbidden · Horizonte CRM",
};

export default function ForbiddenPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--hz-bg)" }}
    >
      <div className="max-w-md space-y-4 text-center">
        <div
          className="hz-mono text-xs uppercase tracking-[.18em]"
          style={{ color: "var(--hz-danger)" }}
        >
          403 · Forbidden
        </div>
        <h1 className="font-display text-3xl font-medium">No access to this area</h1>
        <p className="hz-mono text-sm" style={{ color: "var(--hz-ink-2)" }}>
          This account doesn&apos;t have permission for that page.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <Link href="/login" className="btn-ghost">
            Sign in as a different user
          </Link>
          <Link href="/" className="btn-primary">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
