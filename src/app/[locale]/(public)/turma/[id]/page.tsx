import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { ScheduleTable } from "@/app/(admin)/admin/batches/[id]/schedule-table";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

// Public read-only cronograma viewer. Linked to from the WhatsApp
// "Send schedule" template so students can open it from a chat.

export default async function PublicBatchSchedulePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id, locale } = await params;
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      course: true,
      trainer: { select: { name: true } },
      sessions: {
        orderBy: [{ scheduledDate: "asc" }, { kind: "asc" }],
        include: { module: { select: { id: true, number: true, name: true } } },
      },
    },
  });
  if (!batch) notFound();

  const t = await getTranslations({ locale, namespace: "turma" });

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 print:py-0 print:px-0 print:max-w-none">
      <div className="flex items-center justify-end mb-3 print:hidden">
        <PrintButton label={t("downloadPdf")} />
      </div>
      <ScheduleTable batch={batch} isPrint={false} />
    </section>
  );
}
