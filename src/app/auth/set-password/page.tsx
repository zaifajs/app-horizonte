import { SetPasswordForm } from "./set-password-form";

export const metadata = {
  title: "Set your password · Horizonte CRM",
};

export default function SetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Set your password
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome to Horizonte CRM. Pick a password to finish setting up
            your account.
          </p>
        </div>
        <SetPasswordForm />
      </div>
    </main>
  );
}
