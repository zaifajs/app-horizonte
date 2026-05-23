import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function loginUrl(reqUrl: string, h: Headers): string {
  const proto = h.get("x-forwarded-proto") ?? new URL(reqUrl).protocol.replace(":", "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(reqUrl).host;
  return `${proto}://${host}/login`;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const h = await headers();
  return NextResponse.redirect(loginUrl(request.url, h), { status: 303 });
}

export async function GET(request: Request) {
  return POST(request);
}
