import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in · Horizonte CRM",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "ADMIN" || user.role === "STAFF") redirect("/admin/today");
    if (user.role === "TEACHER") redirect("/teacher");
    redirect("/forbidden");
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--hz-bg)" }}
    >
      <div className="w-full max-w-sm space-y-5">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center glow-primary"
            style={{ background: "var(--hz-primary)" }}
          >
            <span className="hz-mono text-base font-bold" style={{ color: "#0B0E14" }}>
              nh
            </span>
          </div>
          <div className="leading-tight">
            <div
              className="hz-mono text-base font-semibold"
              style={{ color: "var(--hz-ink)", letterSpacing: "-0.005em" }}
            >
              horizonte
              <span style={{ color: "var(--hz-primary)" }}>/</span>
            </div>
            <div
              className="text-xs uppercase tracking-[.18em] hz-mono"
              style={{ color: "var(--hz-ink-3)" }}
            >
              CRM
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="hz-card p-6 space-y-5">
          <div>
            <div
              className="text-xs hz-mono uppercase tracking-[.18em]"
              style={{ color: "var(--hz-ink-3)" }}
            >
              Welcome back
            </div>
            <h1 className="font-display text-2xl font-medium mt-1">Sign in</h1>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
