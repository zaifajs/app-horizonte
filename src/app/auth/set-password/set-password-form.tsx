"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetPasswordForm() {
  const router = useRouter();
  // Single client instance shared between the init effect and onSubmit.
  // Admin-initiated invites have no client-side PKCE verifier, so we use
  // flowType:'implicit' to skip the verifier check on exchangeCodeForSession.
  const supabaseRef = useRef<SupabaseClient | null>(null);

  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: "implicit" } },
    );
    supabaseRef.current = supabase;

    // Detect Supabase error params in the URL hash (e.g. otp_expired).
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const hashError = hash.get("error_description") ?? hash.get("error");
    if (hashError) {
      const msg =
        hash.get("error_code") === "otp_expired"
          ? "This invite link has expired. Ask an admin to resend the invite."
          : decodeURIComponent(hashError.replace(/\+/g, " "));
      // Defer setState out of the synchronous effect body to satisfy the lint rule.
      setTimeout(() => {
        setError(msg);
        setStatus("error");
      }, 0);
      return;
    }

    let resolved = false;

    function handle(session: { user?: { email?: string | null } } | null) {
      if (!session?.user || resolved) return;
      resolved = true;
      setEmail(session.user.email ?? null);
      setStatus("ready");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => handle(session));

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && refreshToken) {
      // Implicit flow: Supabase put the session directly in the URL hash.
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error }) => {
          if (error) console.error("[set-password] setSession failed:", error);
          handle(data.session);
          // Clean the hash so a refresh doesn't re-use the same tokens.
          window.history.replaceState(null, "", window.location.pathname);
        });
    } else if (code) {
      // PKCE flow: exchange the auth code for a session.
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) console.error("[set-password] code exchange failed:", error);
        handle(data.session);
        // Remove the code from the URL so a refresh doesn't re-attempt exchange.
        const clean = new URL(window.location.href);
        clean.searchParams.delete("code");
        window.history.replaceState(null, "", clean.toString());
      });
    } else {
      // No tokens in URL — check for an existing session (e.g. page refresh).
      supabase.auth.getSession().then(({ data }) => handle(data.session));
    }

    const timer = setTimeout(() => {
      if (!resolved) setStatus("error");
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // Redirect to login only when there's no error message to display.
  useEffect(() => {
    if (status === "error" && !error) router.replace("/login");
  }, [status, error, router]);

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
    if (!supabaseRef.current) return;
    setPending(true);
    const { error } = await supabaseRef.current.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
    window.location.href = "/admin/today";
  }

  if (status === "loading") {
    return (
      <p className="text-sm text-muted-foreground">Verifying your invite…</p>
    );
  }
  if (status === "error") {
    if (error) return <p className="text-sm text-destructive">{error}</p>;
    return (
      <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {email ? (
        <p className="text-sm text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground">{email}</span>.
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
