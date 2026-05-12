import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Forbidden · Horizonte CRM",
};

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">403 — Forbidden</h1>
        <p className="text-muted-foreground">
          This account doesn&apos;t have access to that area.
        </p>
        <div className="flex gap-2 justify-center">
          <Link href="/login">
            <Button variant="outline">Sign in as a different user</Button>
          </Link>
          <Link href="/">
            <Button>Go home</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
