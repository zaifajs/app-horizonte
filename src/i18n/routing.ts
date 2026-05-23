import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pt", "bn", "ur", "hi"] as const,
  defaultLocale: "en",
  // Always show the locale in the URL (e.g. /en, /pt, /bn, /ur).
  // Auto-detect from Accept-Language on first visit to "/".
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

export const rtlLocales = new Set<Locale>(["ur"]);
