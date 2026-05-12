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
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Horizonte CRM
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
