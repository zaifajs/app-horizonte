"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavItem({
  href,
  icon,
  label,
  trailing,
  collapsed,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active =
    pathname === href ||
    pathname.startsWith(href + "/") ||
    (href !== "/admin" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`nav-item ${active ? "active" : ""}`}
      style={collapsed ? { padding: "9px 0", justifyContent: "center", gap: 0 } : undefined}
      title={collapsed ? label : undefined}
    >
      {icon}
      {!collapsed ? label : null}
      {!collapsed && trailing ? <span className="ml-auto">{trailing}</span> : null}
    </Link>
  );
}
