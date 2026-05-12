import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">
            {t("header.siteName")}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/register" className="hover:underline">
              {t("header.register")}
            </Link>
            <NextLink href="/login" className="hover:underline">
              {t("header.login")}
            </NextLink>
            <LocaleSwitcher />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl px-4 py-4">© {t("footer.tagline")}</div>
      </footer>
    </div>
  );
}
