import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Avatar } from "@/components/ui/avatar";
import { StudentTabs } from "./_components/top-bar";

const BRAND = {
  short: "nh",
  name: "horizonte",
  versionLabel: "student · v26.05",
};

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["STUDENT"]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--hz-bg)" }}>
      <header
        className="hair-b sticky top-0 z-10 print:hidden"
        style={{ background: "rgba(11,14,20,0.85)", backdropFilter: "saturate(140%) blur(8px)" }}
      >
        <div className="mx-auto max-w-4xl px-4 h-14 flex items-center gap-3">
          <Link href="/student" className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center glow-primary shrink-0"
              style={{ background: "var(--hz-primary)" }}
            >
              <span className="hz-mono text-sm font-bold" style={{ color: "#0B0E14" }}>
                {BRAND.short}
              </span>
            </div>
            <div className="leading-tight min-w-0">
              <div
                className="hz-mono text-base font-semibold truncate"
                style={{ color: "var(--hz-ink)", letterSpacing: "-0.005em" }}
              >
                {BRAND.name}
                <span style={{ color: "var(--hz-primary)" }}>/</span>
              </div>
              <div
                className="text-xs uppercase tracking-[.18em] hz-mono hidden sm:block"
                style={{ color: "var(--hz-ink-3)" }}
              >
                {BRAND.versionLabel}
              </div>
            </div>
          </Link>

          <div className="ml-2 hidden sm:flex">
            <StudentTabs />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <Avatar name={user.name} size={28} />
              <div className="leading-tight">
                <div
                  className="hz-mono text-sm font-semibold truncate max-w-[140px]"
                  style={{ color: "var(--hz-ink)" }}
                >
                  {user.name}
                </div>
                <div className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
                  student
                </div>
              </div>
            </div>
            <div className="sm:hidden">
              <Avatar name={user.name} size={28} />
            </div>
            <Link href="/logout" prefetch={false} className="btn-ghost text-sm">
              <span className="hidden sm:inline">Sign out</span>
              <svg
                className="sm:hidden"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Mobile tab strip */}
        <div className="sm:hidden mx-auto max-w-4xl px-4 pb-2">
          <StudentTabs />
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-5 sm:py-6">
        {children}
      </main>
    </div>
  );
}
