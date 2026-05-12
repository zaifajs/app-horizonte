import { prisma } from "@/lib/db";

/**
 * Returns a map: enrollmentId → sequence number within its batch.
 * 1-indexed, ordered by enrolledAt ascending so the first registrant
 * gets #1 within their batch.
 */
export async function loadBatchSequence(): Promise<Map<string, number>> {
  const enrollments = await prisma.enrollment.findMany({
    orderBy: [{ batchId: "asc" }, { enrolledAt: "asc" }],
    select: { id: true, batchId: true },
  });

  const out = new Map<string, number>();
  let lastBatch = "";
  let seq = 0;
  for (const e of enrollments) {
    if (e.batchId !== lastBatch) {
      lastBatch = e.batchId;
      seq = 0;
    }
    seq++;
    out.set(e.id, seq);
  }
  return out;
}
