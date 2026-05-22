import { requireRole } from "@/lib/auth";
import { Sidebar } from "./_components/sidebar";
import { TopBar } from "./_components/top-bar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["ADMIN", "STAFF"]);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--hz-bg)" }}>
      <Sidebar user={{ name: user.name, role: user.role }} />

      <main className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="px-8 py-7 w-full print:px-0 print:py-0">{children}</div>
      </main>
    </div>
  );
}
