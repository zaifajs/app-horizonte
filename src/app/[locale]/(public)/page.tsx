import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 flex flex-col items-start gap-6">
      <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-lg text-muted-foreground max-w-xl">{t("subtitle")}</p>
      <div className="flex gap-3">
        <Link href="/register">
          <Button>{t("ctaRegister")}</Button>
        </Link>
        <NextLink href="/login">
          <Button variant="outline">{t("ctaLogin")}</Button>
        </NextLink>
      </div>
    </section>
  );
}
