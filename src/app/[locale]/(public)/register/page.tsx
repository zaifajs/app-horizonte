import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("register");
  return { title: t("title") };
}

export default async function RegisterPage() {
  const t = await getTranslations("register");
  const batches = await prisma.batch.findMany({
    where: { status: "UPCOMING" },
    orderBy: { startDate: "asc" },
    select: { id: true, code: true, startDate: true },
  });

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </header>

      <RegisterForm
        batches={batches.map((b) => ({
          id: b.id,
          label: `${b.code} · ${b.startDate.toISOString().slice(0, 10)}`,
        }))}
        t={{
          sections: {
            identity: t("sections.identity"),
            document: t("sections.document"),
            address: t("sections.address"),
            enrolment: t("sections.enrolment"),
            consent: t("sections.consent"),
          },
          fields: {
            fullName: t("fields.fullName"),
            email: t("fields.email"),
            phone: t("fields.phone"),
            phoneHint: t("fields.phoneHint"),
            dob: t("fields.dob"),
            nationality: t("fields.nationality"),
            docType: t("fields.docType"),
            docNumber: t("fields.docNumber"),
            docExpiry: t("fields.docExpiry"),
            docFront: t("fields.docFront"),
            docBack: t("fields.docBack"),
            nif: t("fields.nif"),
            niss: t("fields.niss"),
            address: t("fields.address"),
            city: t("fields.city"),
            batch: t("fields.batch"),
            noBatches: t("fields.noBatches"),
            gdpr: t("fields.gdpr"),
          },
          docTypes: {
            PASSPORT: t("docTypes.PASSPORT"),
            RESIDENCE_PERMIT: t("docTypes.RESIDENCE_PERMIT"),
            ID_CARD: t("docTypes.ID_CARD"),
          },
          submit: t("submit"),
          submitting: t("submitting"),
          success: {
            title: t("success.title"),
            body: t("success.body"),
            again: t("success.again"),
          },
        }}
      />
    </section>
  );
}
