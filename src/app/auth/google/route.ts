import { NextResponse } from "next/server";
import {
  getApplicationOrigin,
  getSafeRedirectPath,
} from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const next = getSafeRedirectPath(requestUrl.searchParams.get("next"));
  const applicationOrigin = getApplicationOrigin(requestUrl);
  const redirectTo = new URL(
    `/auth/callback?next=${encodeURIComponent(next)}`,
    applicationOrigin,
  ).toString();

  try {
    const { data, error } = await (
      await createClient()
    ).auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error || !data.url) {
      return NextResponse.redirect(
        new URL(
          `/sign-in?error=oauth&next=${encodeURIComponent(next)}`,
          applicationOrigin,
        ),
      );
    }

    return NextResponse.redirect(data.url);
  } catch {
    return NextResponse.redirect(
      new URL(
        `/sign-in?error=oauth&next=${encodeURIComponent(next)}`,
        applicationOrigin,
      ),
    );
  }
}
