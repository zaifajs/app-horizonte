import { prisma } from "@/lib/db";
import { requireRole, type AuthedUser } from "@/lib/auth";

export type StudentContext = Awaited<ReturnType<typeof loadStudentContext>>;

export async function loadStudentContext() {
  const user: AuthedUser = await requireRole(["STUDENT"]);

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    include: {
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        include: {
          batch: {
            include: {
              course: true,
              // Pull the trainer's TeacherProfile so the student home page
              // can render a "Your teacher" card with photo + bio +
              // languages. The Supabase storage paths are signed on demand
              // in the page itself, never sent to the client raw.
              trainer: {
                select: {
                  id: true,
                  name: true,
                  teacherProfile: {
                    select: {
                      bio: true,
                      languages: true,
                      photoStoragePath: true,
                    },
                  },
                },
              },
              sessions: {
                orderBy: [{ scheduledDate: "asc" }, { kind: "asc" }],
                include: { module: { select: { id: true, number: true, name: true } } },
              },
            },
          },
          payments: { orderBy: { paidAt: "asc" } },
          attendances: { select: { sessionId: true, state: true } },
        },
      },
    },
  });

  if (!student) return { user, student: null, currentEnrollment: null as null };

  // Prefer ACTIVE, then PENDING, then the most recent (already sorted desc).
  const currentEnrollment =
    student.enrollments.find((e) => e.status === "ACTIVE") ??
    student.enrollments.find((e) => e.status === "PENDING") ??
    student.enrollments[0] ??
    null;

  return { user, student, currentEnrollment };
}
