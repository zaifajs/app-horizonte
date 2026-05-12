"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SetPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // null = still resolving, true = signed in, false = no session after timeout
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // @supabase/ssr uses PKCE: Supabase redirects to this page with ?code=<auth_code>.
  // We must exchange that code for a session before the SDK has anything to report.
  // Fallback: also handle the legacy implicit flow where the hash carries access_token.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let resolved = false;

    function handle(session: { user?: { email?: string | null } } | null) {
      if (!session?.user || resolved) return;
      resolved = true;
      setEmail(session.user.email ?? null);
      setHasSession(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => handle(session),
    );

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      // PKCE flow: exchange the auth code for a session. onAuthStateChange fires after.
      supabase.auth.exchangeCodeForSession(code).then(({ data }) => {
        handle(data.session);
        // Clean the code out of the URL so a refresh doesn't re-attempt the exchange.
        const clean = new URL(window.location.href);
        clean.searchParams.delete("code");
        window.history.replaceState(null, "", clean.toString());
      });
    } else {
      // Implicit flow or already-active session: getSession() is enough.
      supabase.auth.getSession().then(({ data }) => handle(data.session));
    }

    const timer = setTimeout(() => {
      if (!resolved) setHasSession(false);
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // Once we're sure there's no session, kick to /login.
  useEffect(() => {
    if (hasSession === false) router.replace("/login");
  }, [hasSession, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
    window.location.href = "/admin/today";
  }

  if (hasSession === null) {
    return (
      <p className="text-sm text-muted-foreground">Verifying your invite…</p>
    );
  }
  if (hasSession === false) {
    return (
      <p className="text-sm text-muted-foreground">
        Redirecting to sign in…
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {email ? (
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{email}</span>.
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Setting password…" : "Set password and sign in"}
      </Button>
    </form>
  );
}
