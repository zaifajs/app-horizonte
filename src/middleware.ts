import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Apply i18n routing to everything EXCEPT:
  //  - /admin/*  (admin/staff/teacher views are English-only)
  //  - /api/*    (server endpoints)
  //  - /_next/*, /_vercel/*  (framework internals)
  //  - any file with an extension (favicon, images, .ico, etc.)
  matcher: ["/((?!admin|api|_next|_vercel|.*\\..*).*)"],
};
