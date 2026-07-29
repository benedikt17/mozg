import { NextResponse } from "next/server";
import {
  getApplicationOrigin,
  getSafeRedirectPath,
} from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const next = getSafeRedirectPath(url.searchParams.get("next"));
  const applicationOrigin = getApplicationOrigin(url);
  const errorRedirect = new URL(
    `/sign-in?error=oauth&next=${encodeURIComponent(next)}`,
    applicationOrigin,
  );
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(errorRedirect);
  const { error } = await (
    await createClient()
  ).auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(errorRedirect);
  return NextResponse.redirect(new URL(next, applicationOrigin));
}
