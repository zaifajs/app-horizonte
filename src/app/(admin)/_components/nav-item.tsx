"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavItem({
  href,
  icon,
  label,
  trailing,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
}) {
  const pathname = usePathname();
  const active =
    pathname === href || pathname.startsWith(href + "/") || (href !== "/admin" && pathname.startsWith(href));
  return (
    <Link href={href} className={`nav-item ${active ? "active" : ""}`}>
      {icon}
      {label}
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </Link>
  );
}
