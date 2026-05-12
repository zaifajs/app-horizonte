import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { getLocale } from "next-intl/server";
import { routing, rtlLocales, type Locale } from "@/i18n/routing";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Horizonte CRM",
  description: "Novo Horizonte — Portuguese as a Welcoming Language",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Admin routes don't run the locale middleware, so getLocale() returns the
  // default ("en") there. Public routes carry a real locale.
  const raw = await getLocale();
  const locale = (routing.locales as readonly string[]).includes(raw)
    ? (raw as Locale)
    : routing.defaultLocale;
  const dir = rtlLocales.has(locale) ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
