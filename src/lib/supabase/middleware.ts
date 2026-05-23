// Refreshes the Supabase session on every request. Returns an updated
// NextResponse with refreshed auth cookies. Called from src/middleware.ts.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSupabaseSession(
  request: NextRequest,
  response: NextResponse = NextResponse.next({ request }),
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Triggers session refresh + re-issued cookies if needed.
  await supabase.auth.getUser();

  return response;
}
