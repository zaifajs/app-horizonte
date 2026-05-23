"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/student", label: "Home" },
  { href: "/student/schedule", label: "Schedule" },
  { href: "/student/payments", label: "Payments" },
];

export function StudentTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1" aria-label="Student sections">
      {TABS.map((t) => {
        const active = t.href === "/student" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="btn-ghost text-sm"
            aria-current={active ? "page" : undefined}
            style={
              active
                ? {
                    color: "var(--hz-ink)",
                    background: "color-mix(in oklab, var(--hz-primary) 12%, transparent)",
                  }
                : undefined
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
