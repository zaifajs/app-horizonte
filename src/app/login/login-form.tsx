"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "signin" | "reset";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Use the role stored in user metadata to pick the right home page.
    // Keeps STUDENT → /student so it doesn't fall through to /admin/today
    // and bounce off the admin-only role gate to /forbidden.
    const role = data.user?.user_metadata?.role as string | undefined;
    const dest =
      role === "STUDENT"
        ? "/student"
        : role === "TEACHER"
          ? "/teacher"
          : "/admin/today";
    router.refresh();
    router.push(dest);
  }

  async function onSendReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Enter your email so we can send the reset link.");
      return;
    }
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    // Supabase emails the user a link that lands here; after they click it
    // they're authenticated and can change their password.
    // redirectTo: /auth/set-password lets the user pick a new password.
    // It already handles both implicit (hash tokens) and PKCE (code query)
    // flows for the existing invite path, so recovery reuses it. /login
    // would redirect authed users away before they could set a new password.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/set-password?mode=recovery`,
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo(`Reset link sent to ${email}. Check your inbox.`);
  }

  if (mode === "reset") {
    return (
      <form onSubmit={onSendReset} className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-medium">Reset your password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll email you a link to set a new password.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {info ? <p className="text-sm" style={{ color: "var(--hz-success)" }}>{info}</p> : null}
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "Sending…" : "Send reset link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMode("signin");
              setError(null);
              setInfo(null);
            }}
            disabled={pending}
          >
            Back
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSignIn} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            onClick={() => {
              setMode("reset");
              setError(null);
              setInfo(null);
            }}
            className="text-xs underline"
            style={{ color: "var(--hz-ink-2)" }}
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
