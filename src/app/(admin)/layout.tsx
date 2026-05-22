import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { NavItem } from "./_components/nav-item";
import { Breadcrumbs } from "./_components/breadcrumbs";

// Brand config — single source of truth so a future white-label
// swap is one block of changes.
const BRAND = {
  short: "nh",
  name: "horizonte",
  versionLabel: "admin · v26.05",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["ADMIN", "STAFF"]);
  const initials =
    user.name
      ?.split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "??";

  return (
    <div className="flex min-h-screen" style={{ background: "var(--hz-bg)" }}>
      {/* ============ SIDEBAR ============ */}
      <aside
        className="hair-r flex flex-col print:hidden"
        style={{ width: 232, background: "var(--hz-surface)", position: "sticky", top: 0, height: "100vh" }}
      >
        {/* Brand */}
        <div className="px-4 pt-4 pb-4 hair-b">
          <Link href="/admin/today" className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center glow-primary"
              style={{ background: "var(--hz-primary)" }}
            >
              <span className="hz-mono text-[12px] font-bold" style={{ color: "#0B0E14" }}>
                {BRAND.short}
              </span>
            </div>
            <div className="leading-tight">
              <div
                className="hz-mono text-[13px] font-semibold"
                style={{ color: "var(--hz-ink)", letterSpacing: "-0.005em" }}
              >
                {BRAND.name}
                <span style={{ color: "var(--hz-primary)" }}>/</span>
              </div>
              <div
                className="text-[10px] uppercase tracking-[.18em] hz-mono"
                style={{ color: "var(--hz-ink-3)" }}
              >
                {BRAND.versionLabel}
              </div>
            </div>
          </Link>
        </div>

        {/* Search (placeholder — wire ⌘K palette later) */}
        <div className="px-3 pt-3 pb-2">
          <button
            type="button"
            className="w-full flex items-center gap-2 h-8 px-2 rounded-md text-[12.5px]"
            style={{ border: "1px solid var(--hz-line)", color: "var(--hz-ink-3)", background: "var(--hz-bg)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="hz-mono">Search…</span>
            <span className="ml-auto kbd">⌘K</span>
          </button>
        </div>

        {/* Workspace nav */}
        <div className="px-4 pt-3 pb-1.5">
          <div className="text-[9.5px] uppercase tracking-[.18em] hz-mono font-semibold" style={{ color: "var(--hz-ink-3)" }}>
            Workspace
          </div>
        </div>
        <nav className="px-3 flex flex-col gap-0.5">
          <NavItem
            href="/admin/today"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            }
            label="Today"
          />
          <NavItem
            href="/admin/students"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            label="Students"
          />
          <NavItem
            href="/admin/batches"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 10h18" />
                <path d="M8 4v4" />
                <path d="M16 4v4" />
              </svg>
            }
            label="Batches"
          />
          {user.role === "ADMIN" ? (
            <NavItem
              href="/admin/users"
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
              label="Users"
            />
          ) : null}
        </nav>

        {/* System line */}
        <div className="mt-auto px-4 pt-3 pb-2 text-[10px] hz-mono" style={{ color: "var(--hz-ink-3)" }}>
          <div className="flex items-center gap-1.5">
            <span
              className="dot"
              style={{ background: "var(--hz-success)", boxShadow: "0 0 6px var(--hz-success)" }}
            />
            All systems normal
          </div>
        </div>

        {/* User */}
        <div className="p-3 hair-t">
          <Link
            href="/logout"
            prefetch={false}
            className="w-full flex items-center gap-2 p-1.5 rounded-md"
            style={{ background: "var(--hz-surface-2)" }}
            title="Sign out"
          >
            <span className="avi">{initials}</span>
            <span className="text-left leading-tight flex-1 min-w-0">
              <span
                className="block text-[12.5px] font-semibold truncate hz-mono"
                style={{ color: "var(--hz-ink)" }}
              >
                {user.name}
              </span>
              <span
                className="block text-[10px] truncate hz-mono"
                style={{ color: "var(--hz-ink-3)" }}
              >
                {user.role.toLowerCase()}
              </span>
            </span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--hz-ink-3)" }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </Link>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          className="hair-b sticky top-0 z-10 print:hidden"
          style={{ background: "rgba(11,14,20,0.85)", backdropFilter: "saturate(140%) blur(8px)" }}
        >
          <div className="px-8 h-12 flex items-center gap-3">
            <Breadcrumbs />
          </div>
        </header>

        <div className="px-8 py-7 max-w-[1320px] w-full print:max-w-none print:px-0 print:py-0">
          {children}
        </div>
      </main>
    </div>
  );
}
