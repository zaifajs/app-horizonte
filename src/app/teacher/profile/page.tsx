import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getSignedDocUrl } from "@/lib/storage";
import { TeacherProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "My profile · Horizonte CRM" };

export default async function TeacherProfilePage() {
  const user = await requireRole(["TEACHER"]);

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: user.id },
    select: {
      bio: true,
      phone: true,
      languages: true,
      photoStoragePath: true,
      cvStoragePath: true,
      updatedAt: true,
    },
  });

  // Sign the upload URLs server-side so the client can render the existing
  // photo + link the CV without ever seeing the storage internals. Short
  // TTL because the page re-renders dynamically anyway.
  const [photoUrl, cvUrl] = await Promise.all([
    profile?.photoStoragePath ? getSignedDocUrl(profile.photoStoragePath, 1800) : null,
    profile?.cvStoragePath ? getSignedDocUrl(profile.cvStoragePath, 1800) : null,
  ]);

  // Lifetime stats — batches taught + classroom sessions held — to give the
  // teacher a small "this is your record" panel alongside the editable bits.
  const [batchesCount, heldCount, gradedCount] = await Promise.all([
    prisma.batch.count({ where: { trainerId: user.id } }),
    prisma.batchSession.count({
      where: {
        kind: "CLASSROOM",
        status: "HELD",
        batch: { trainerId: user.id },
      },
    }),
    prisma.examSubmission.count({
      where: { gradedById: user.id },
    }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <div
          className="text-xs hz-mono uppercase tracking-[.18em]"
          style={{ color: "var(--hz-ink-3)" }}
        >
          Teacher
        </div>
        <h1 className="font-display text-3xl font-medium mt-1">
          {user.name}
        </h1>
        <p className="mt-1.5 hz-mono text-sm" style={{ color: "var(--hz-ink-2)" }}>
          {user.email}
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile label="Batches taught" value={String(batchesCount)} />
        <StatTile label="Sessions held" value={String(heldCount)} />
        <StatTile label="Exams graded" value={String(gradedCount)} />
      </section>

      <TeacherProfileForm
        initial={{
          name: user.name,
          bio: profile?.bio ?? "",
          phone: profile?.phone ?? "",
          languages: profile?.languages ?? "",
          photoUrl,
          cvUrl,
          updatedAt: profile?.updatedAt?.toISOString() ?? null,
        }}
      />
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
