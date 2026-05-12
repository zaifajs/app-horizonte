import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: Request) {
  // Convenience: a plain link to /logout also signs the user out.
  return POST(request);
}
