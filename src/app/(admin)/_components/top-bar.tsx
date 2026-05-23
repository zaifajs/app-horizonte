"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Breadcrumbs } from "./breadcrumbs";

// The top-bar "+ new" button changes target based on the current section so
// it doesn't always mean "new student" no matter where you are.
function newButtonFor(pathname: string): { href: string; label: string } | null {
  if (pathname.startsWith("/admin/batches")) return { href: "/admin/batches/new", label: "batch" };
  if (pathname.startsWith("/admin/students") || pathname === "/admin/today")
    return { href: "/admin/students/new", label: "student" };
  // Templates + Users pages already expose their own "New …" / "Invite user"
  // affordance; an extra ambiguous "+ new" here just adds noise.
  return null;
}

function format(now: Date): string {
  const wd = now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const dd = String(now.getDate()).padStart(2, "0");
  const mon = now.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const yy = String(now.getFullYear()).slice(-2);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${wd} · ${dd} ${mon} ${yy} · ${hh}:${mm}`;
}

export function TopBar() {
  const [stamp, setStamp] = useState<string | null>(null);
  const pathname = usePathname() ?? "";
  const newBtn = newButtonFor(pathname);

  useEffect(() => {
    setStamp(format(new Date()));
    const t = setInterval(() => setStamp(format(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      className="hair-b sticky top-0 z-10 print:hidden"
      style={{ background: "rgba(11,14,20,0.85)", backdropFilter: "saturate(140%) blur(8px)" }}
    >
      <div className="px-8 h-12 flex items-center gap-3">
        <Breadcrumbs />
        {stamp ? (
          <span className="chip chip-outline ml-2">
            <span
              className="dot"
              style={{ background: "var(--hz-primary)", boxShadow: "0 0 6px var(--hz-primary)" }}
            />
            {stamp}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className="ibtn" title="Refresh" onClick={() => location.reload()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          </button>
          <button type="button" className="ibtn" title="Notifications" style={{ position: "relative" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <span
              style={{
                position: "absolute",
                top: 5,
                right: 5,
                width: 5,
                height: 5,
                background: "var(--hz-danger)",
                borderRadius: "50%",
                border: "1px solid var(--hz-surface)",
              }}
            />
          </button>
          {newBtn ? (
            <Link href={newBtn.href} className="btn-ghost" title={`New ${newBtn.label}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              {newBtn.label}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
