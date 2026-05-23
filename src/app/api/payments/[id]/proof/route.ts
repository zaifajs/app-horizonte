import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSignedDocUrl } from "@/lib/storage";

// GET /api/payments/:id/proof  →  302 redirect to a 1-hour signed Storage URL.
// Gated to admin/staff (audit-logged uploads, sensitive document).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole(["ADMIN", "STAFF"]);
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: { proofStoragePath: true },
  });
  if (!payment?.proofStoragePath) {
    return new NextResponse("No proof on file.", { status: 404 });
  }
  const url = await getSignedDocUrl(payment.proofStoragePath, 3600);
  return NextResponse.redirect(url, 302);
}
