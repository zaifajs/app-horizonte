import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Exams · Horizonte CRM" };

// Admin-side exam authoring landing. Lists every Module (across all Courses)
// with its current Exam row + question count. Click into a module to author
// the exam. Today there's only PLA, so this reads as one list; if more
// courses get added later we can group by course.

export default async function ExamsIndexPage() {
  const modules = await prisma.module.findMany({
    orderBy: [{ courseId: "asc" }, { number: "asc" }],
    include: {
      course: { select: { code: true, name: true } },
      exams: {
        select: {
          id: true,
          title: true,
          passingScore: true,
          durationMinutes: true,
          _count: { select: { questions: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-5">
      <section className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div
            className="text-xs hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Assessment
          </div>
          <h1 className="font-display text-4xl font-medium mt-1">Exams</h1>
          <p
            className="mt-1.5 text-sm hz-mono"
            style={{ color: "var(--hz-ink-2)" }}
          >
            {modules.length} {modules.length === 1 ? "module" : "modules"} ·
            one exam per module · authored once, reused across every batch
          </p>
        </div>
      </section>

      <section className="hz-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="stbl w-full text-sm">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Module</th>
                <th>Title</th>
                <th>Course</th>
                <th>Questions</th>
                <th>Pass</th>
                <th>Duration</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {modules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 hz-mono" style={{ color: "var(--hz-ink-3)" }}>
                    No modules yet. Create a course first.
                  </td>
                </tr>
              ) : (
                modules.map((m) => {
                  const exam = m.exams[0];
                  return (
                    <tr key={m.id}>
                      <td>
                        <span
                          className="hz-mono font-semibold"
                          style={{ color: "var(--hz-primary)" }}
                        >
                          M{m.number}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/admin/exams/${m.id}`}
                          className="font-medium hover:underline"
                        >
                          {exam?.title ?? m.name}
                        </Link>
                        {!exam ? (
                          <span
                            className="ml-2 chip chip-outline"
                            style={{ fontSize: "10px" }}
                          >
                            DRAFT
                          </span>
                        ) : null}
                      </td>
                      <td className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
                        {m.course.code}
                      </td>
                      <td className="hz-mono">
                        {exam?._count.questions ?? 0}
                      </td>
                      <td className="hz-mono">
                        {exam ? `${exam.passingScore}%` : "—"}
                      </td>
                      <td className="hz-mono">
                        {exam ? `${exam.durationMinutes}m` : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/admin/exams/${m.id}`}
                          className="ibtn"
                          title="Open editor"
                          aria-label={`Open exam editor for M${m.number}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
