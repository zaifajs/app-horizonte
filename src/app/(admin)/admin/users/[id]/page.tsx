import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getSignedDocUrl } from "@/lib/storage";
import { Avatar } from "@/components/ui/avatar";
import { TeacherProfileForm } from "@/app/teacher/profile/profile-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "User · Horizonte CRM" };

// Admin / staff detail view for a single User row. Today only TEACHER users
// have a profile surface; other roles 404 from here so we don't render a
// half-baked page. The same TeacherProfileForm component runs in this
// admin path with the `forUserId` prop set — server action distinguishes
// admin-edits-other vs teacher-edits-self by the authed user's role.

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN", "STAFF"]);
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      teacherProfile: true,
      batchesTaught: {
        select: {
          id: true,
          code: true,
          status: true,
          startDate: true,
          course: { select: { code: true } },
        },
        orderBy: { startDate: "desc" },
      },
      _count: {
        select: {
          batchesTaught: true,
          sessionsOver: true,
          examsGraded: true,
        },
      },
    },
  });
  if (!user) notFound();
  if (user.role !== "TEACHER") notFound();

  // Sessions held by this teacher (CLASSROOM kind, status HELD). Counted
  // off the related Batch records to avoid pulling every session row.
  const heldCount = await prisma.batchSession.count({
    where: {
      status: "HELD",
      kind: "CLASSROOM",
      batch: { trainerId: user.id },
    },
  });

  const [photoUrl, cvUrl] = await Promise.all([
    user.teacherProfile?.photoStoragePath
      ? getSignedDocUrl(user.teacherProfile.photoStoragePath, 1800)
      : null,
    user.teacherProfile?.cvStoragePath
      ? getSignedDocUrl(user.teacherProfile.cvStoragePath, 1800)
      : null,
  ]);

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-4 flex-wrap">
        <Avatar name={user.name} size={56} fontSize="1rem" />
        <div className="min-w-0 flex-1">
          <div
            className="text-xs hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Teacher
          </div>
          <h1 className="font-display text-3xl font-medium mt-1">
            {user.name}
          </h1>
          <p
            className="mt-1.5 hz-mono text-sm"
            style={{ color: "var(--hz-ink-2)" }}
          >
            {user.email}
            <span className="mx-2" style={{ color: "var(--hz-ink-3)" }}>·</span>
            {user.isActive ? (
              <span style={{ color: "var(--hz-success)" }}>Active</span>
            ) : (
              <span style={{ color: "var(--hz-ink-3)" }}>Inactive</span>
            )}
          </p>
        </div>
        <Link href="/admin/users" className="btn-ghost">
          Back to users
        </Link>
      </header>

      {/* Lifetime stats */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile label="Batches taught" value={String(user._count.batchesTaught)} />
        <StatTile label="Sessions held" value={String(heldCount)} />
        <StatTile label="Exams graded" value={String(user._count.examsGraded)} />
      </section>

      {/* Editable profile — same component as self-service /teacher/profile,
          but the forUserId override means save/upload actions target this
          teacher rather than the admin's own (non-existent) profile. */}
      <TeacherProfileForm
        forUserId={user.id}
        initial={{
          name: user.name,
          bio: user.teacherProfile?.bio ?? "",
          phone: user.teacherProfile?.phone ?? "",
          languages: user.teacherProfile?.languages ?? "",
          photoUrl,
          cvUrl,
          updatedAt: user.teacherProfile?.updatedAt?.toISOString() ?? null,
        }}
      />

      {/* Batches the teacher owns */}
      {user.batchesTaught.length > 0 ? (
        <section className="space-y-2">
          <h2 className="section-title">Batches</h2>
          <ul className="hz-card divide-y" style={{ borderColor: "var(--hz-line)" }}>
            {user.batchesTaught.map((b) => (
              <li
                key={b.id}
                className="px-4 py-3 flex items-center gap-3 flex-wrap"
                style={{ borderColor: "var(--hz-line)" }}
              >
                <Link
                  href={`/admin/batches/${b.id}`}
                  className="hz-mono font-semibold"
                  style={{ color: "var(--hz-primary)" }}
                >
                  {b.code}
                </Link>
                <span className="text-sm" style={{ color: "var(--hz-ink-2)" }}>
                  {b.course.code}
                </span>
                <span
                  className="hz-mono text-xs"
                  style={{ color: "var(--hz-ink-3)" }}
                >
                  starts {format(b.startDate, "yyyy-MM-dd")}
                </span>
                <span className="ml-auto chip chip-outline">
                  {b.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="hz-card p-3">
      <div
        className="text-xs hz-mono uppercase tracking-[.16em]"
        style={{ color: "var(--hz-ink-3)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 stat-num"
        style={{
          color: "var(--hz-ink)",
          fontSize: "1.5rem",
          fontFamily: "var(--font-display)",
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
    </div>
  );
}
