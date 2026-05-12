import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const intl = createIntlMiddleware(routing);

const NON_LOCALE_PATHS = [
  "/admin",
  "/teacher",
  "/login",
  "/logout",
  "/forbidden",
];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always refresh the Supabase session first so downstream route guards see
  // the latest auth state.
  const sessionResponse = await updateSupabaseSession(request);

  // Routes that should NOT carry a locale prefix (admin/staff/teacher UI,
  // auth endpoints). Skip the i18n middleware entirely so we don't redirect
  // /admin to /en/admin.
  const isNonLocale = NON_LOCALE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isNonLocale) {
    return sessionResponse;
  }

  // For everything else (public student-facing pages), apply locale routing.
  // We need to thread the refreshed cookies into the intl response.
  const intlResponse = intl(request);
  // Copy refreshed Supabase cookies onto the intl response.
  sessionResponse.cookies.getAll().forEach((c) => {
    intlResponse.cookies.set(c.name, c.value);
  });
  return intlResponse;
}

export const config = {
  matcher: [
    // Match everything except framework internals and static assets.
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};

// Silence eslint about NextResponse import being unused if it ever happens.
export { NextResponse };
