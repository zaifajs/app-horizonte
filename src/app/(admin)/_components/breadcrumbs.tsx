"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Renders the path as `admin / students / new` segments. The leading "admin"
// is always present; trailing segments are clickable except the last one.
export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean); // e.g. ["admin","students","new"]
  if (parts.length === 0 || parts[0] !== "admin") {
    return null;
  }
  return (
    <nav className="flex items-center gap-2 text-[14px] hz-mono" style={{ color: "var(--hz-ink-3)" }}>
      {parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        const href = "/" + parts.slice(0, i + 1).join("/");
        return (
          <span key={href} className="flex items-center gap-2">
            {isLast ? (
              <span style={{ color: "var(--hz-ink)" }}>{decodeURIComponent(p)}</span>
            ) : (
              <Link href={href} className="hover:text-[var(--hz-ink)]">
                {decodeURIComponent(p)}
              </Link>
            )}
            {!isLast ? <span style={{ color: "var(--hz-ink-3)" }}>/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
