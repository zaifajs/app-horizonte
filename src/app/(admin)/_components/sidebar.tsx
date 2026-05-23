"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavItem } from "./nav-item";
import { Avatar } from "@/components/ui/avatar";

const COLLAPSE_KEY = "horizonte.sidebar.collapsed";

const BRAND = {
  short: "nh",
  name: "horizonte",
  versionLabel: "admin · v26.05",
};

export type PinnedBatch = {
  id: string;
  code: string;
  status: "ACTIVE" | "UPCOMING";
  subtitle: string;
};

export function Sidebar({
  user,
  counts,
  pinnedBatches,
}: {
  user: { name: string; role: string };
  counts: { urgent: number; students: number; batches: number };
  pinnedBatches: PinnedBatch[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* localStorage unavailable */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* localStorage unavailable */
    }
  }, [collapsed, hydrated]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && target.matches("input, textarea, [contenteditable]")) return;
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);


  return (
    <aside
      className={`hair-r hidden lg:flex flex-col print:hidden hz-sidebar ${collapsed ? "hz-sidebar-collapsed" : ""}`}
      style={{
        background: "var(--hz-surface)",
        position: "sticky",
        top: 0,
        height: "100vh",
        width: collapsed ? 80 : 272,
        transition: "width 0.15s ease",
        overflow: "visible",
        zIndex: 30,
      }}
    >
      {/* Toggle pill */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label="Toggle sidebar"
        title="Toggle sidebar (press [ or ])"
        aria-keyshortcuts="["
        className="hz-sb-toggle"
        style={{
          position: "absolute",
          top: 18,
          right: -11,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--hz-surface)",
          border: "1px solid var(--hz-line)",
          color: "var(--hz-ink-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 50,
          transition: "color 0.15s, border-color 0.15s, background 0.15s",
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      {/* Brand */}
      <div className={`pt-4 pb-4 hair-b ${collapsed ? "px-3" : "px-4"}`}>
        <Link href="/admin/today" className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center glow-primary shrink-0"
            style={{ background: "var(--hz-primary)" }}
          >
            <span className="hz-mono text-base font-bold" style={{ color: "#0B0E14" }}>
              {BRAND.short}
            </span>
          </div>
          {!collapsed ? (
            <div className="leading-tight">
              <div
                className="hz-mono text-base font-semibold"
                style={{ color: "var(--hz-ink)", letterSpacing: "-0.005em" }}
              >
                {BRAND.name}
                <span style={{ color: "var(--hz-primary)" }}>/</span>
              </div>
              <div
                className="text-sm uppercase tracking-[.18em] hz-mono"
                style={{ color: "var(--hz-ink-3)" }}
              >
                {BRAND.versionLabel}
              </div>
            </div>
          ) : null}
        </Link>
      </div>

      {/* Search */}
      <div className={`pt-3 pb-2 ${collapsed ? "px-3" : "px-3"}`}>
        <button
          type="button"
          className={`w-full flex items-center h-8 rounded-md text-base ${collapsed ? "justify-center" : "gap-2 px-2"}`}
          style={{ border: "1px solid var(--hz-line)", color: "var(--hz-ink-3)", background: "var(--hz-bg)" }}
          title="Search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {!collapsed ? (
            <>
              <span className="hz-mono">Search…</span>
              <span className="ml-auto kbd">⌘K</span>
            </>
          ) : null}
        </button>
      </div>

      {/* Workspace nav */}
      {!collapsed ? (
        <div className="px-4 pt-3 pb-1.5">
          <div className="text-xs uppercase tracking-[.18em] hz-mono font-semibold" style={{ color: "var(--hz-ink-3)" }}>
            Workspace
          </div>
        </div>
      ) : (
        <div className="pt-3" />
      )}
      <nav className={`flex flex-col gap-0.5 ${collapsed ? "px-2" : "px-3"}`}>
        <NavItem
          href="/admin/today"
          collapsed={collapsed}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          }
          label="Today"
          trailing={
            counts.urgent > 0 ? <span className="chip chip-danger">{counts.urgent}</span> : null
          }
        />
        <NavItem
          href="/admin/students"
          collapsed={collapsed}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          label="Students"
          trailing={
            counts.students > 0 ? (
              <span className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
                {counts.students}
              </span>
            ) : null
          }
        />
        <NavItem
          href="/admin/batches"
          collapsed={collapsed}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 10h18" />
              <path d="M8 4v4" />
              <path d="M16 4v4" />
            </svg>
          }
          label="Batches"
          trailing={
            counts.batches > 0 ? (
              <span className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
                {counts.batches}
              </span>
            ) : null
          }
        />
        <NavItem
          href="/admin/finance"
          collapsed={collapsed}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M2 10h20" />
              <path d="M6 14h4" />
              <path d="M18 14h.01" />
            </svg>
          }
          label="Finance"
        />
        <NavItem
          href="/admin/exams"
          collapsed={collapsed}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="m9 13 2 2 4-4" />
            </svg>
          }
          label="Exams"
        />
        <NavItem
          href="/admin/messages/templates"
          collapsed={collapsed}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
          label="Templates"
        />
        {user.role === "ADMIN" ? (
          <NavItem
            href="/admin/users"
            collapsed={collapsed}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
            label="Users"
          />
        ) : null}
      </nav>

      {/* PINNED */}
      {!collapsed && pinnedBatches.length > 0 ? (
        <>
          <div className="px-4 pt-6 pb-1.5">
            <div className="text-xs uppercase tracking-[.18em] hz-mono font-semibold" style={{ color: "var(--hz-ink-3)" }}>
              Pinned
            </div>
          </div>
          <div className="px-3 flex flex-col gap-0.5">
            {pinnedBatches.map((b) => (
              <Link
                key={b.id}
                href={`/admin/batches/${b.id}`}
                className="nav-item"
              >
                <span className="hz-mono text-base font-semibold" style={{ color: "var(--hz-primary)" }}>
                  {b.code}
                </span>
                <span className="truncate" style={{ color: "var(--hz-ink-2)" }}>
                  {b.subtitle}
                </span>
                <span
                  className="ml-auto status-pill"
                  style={{ color: b.status === "ACTIVE" ? "var(--hz-success)" : "var(--hz-warning)" }}
                >
                  <span
                    className="dot"
                    style={{ background: b.status === "ACTIVE" ? "var(--hz-success)" : "var(--hz-warning)" }}
                  />
                  {b.status === "ACTIVE" ? "active" : "soon"}
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {/* System line */}
      {!collapsed ? (
        <div className="mt-auto px-4 pt-3 pb-2 text-sm hz-mono" style={{ color: "var(--hz-ink-3)" }}>
          <div className="flex items-center gap-1.5">
            <span
              className="dot"
              style={{ background: "var(--hz-success)", boxShadow: "0 0 6px var(--hz-success)" }}
            />
            Online
          </div>
        </div>
      ) : (
        <div className="mt-auto" />
      )}

      {/* User */}
      <div className={`p-3 hair-t ${collapsed ? "flex justify-center" : ""}`}>
        <Link
          href="/logout"
          prefetch={false}
          className={`flex items-center rounded-md ${collapsed ? "p-0" : "w-full gap-2 p-1.5"}`}
          style={collapsed ? undefined : { background: "var(--hz-surface-2)" }}
          title="Sign out"
        >
          <Avatar name={user.name} />
          {!collapsed ? (
            <>
              <span className="text-left leading-tight flex-1 min-w-0">
                <span
                  className="block text-base font-semibold truncate hz-mono"
                  style={{ color: "var(--hz-ink)" }}
                >
                  {user.name}
                </span>
                <span
                  className="block text-sm truncate hz-mono"
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
            </>
          ) : null}
        </Link>
      </div>
    </aside>
  );
}
