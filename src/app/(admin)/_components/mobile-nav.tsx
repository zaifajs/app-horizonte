"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    href: "/admin/today",
    label: "Today",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: "/admin/students",
    label: "Students",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/admin/batches",
    label: "Batches",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 4v4" />
        <path d="M16 4v4" />
      </svg>
    ),
  },
  {
    href: "/admin/messages/templates",
    label: "Templates",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

const USER_ITEM = {
  href: "/admin/users",
  label: "Users",
  icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
};

export function MobileNav({
  isAdmin,
  urgentCount,
}: {
  isAdmin: boolean;
  urgentCount: number;
}) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV, USER_ITEM] : NAV;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 hair-t print:hidden"
      style={{
        background: "rgba(11,14,20,0.95)",
        backdropFilter: "saturate(140%) blur(8px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="flex items-stretch justify-around">
        {items.map((it) => {
          const active =
            pathname === it.href ||
            pathname.startsWith(it.href + "/") ||
            (it.href !== "/admin" && pathname.startsWith(it.href));
          const showBadge = it.href === "/admin/today" && urgentCount > 0;
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 relative"
                style={{
                  color: active ? "var(--hz-primary)" : "var(--hz-ink-2)",
                  minHeight: 56,
                }}
              >
                {active ? (
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 28,
                      height: 2,
                      background: "var(--hz-primary)",
                      borderRadius: "0 0 2px 2px",
                    }}
                  />
                ) : null}
                <span style={{ position: "relative" }}>
                  {it.icon}
                  {showBadge ? (
                    <span
                      className="chip chip-danger"
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -10,
                        padding: "1px 5px",
                        fontSize: "0.6875rem",
                      }}
                    >
                      {urgentCount}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] hz-mono">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
