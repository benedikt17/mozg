"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function decide(formData: FormData, approved: boolean): Promise<void> {
  const authorizationId = formData.get("authorization_id");
  if (
    typeof authorizationId !== "string" ||
    !/^[\w-]{1,250}$/.test(authorizationId)
  ) {
    redirect("/oauth/consent?error=invalid");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`,
    );
  }
  const { data, error } = approved
    ? await supabase.auth.oauth.approveAuthorization(authorizationId)
    : await supabase.auth.oauth.denyAuthorization(authorizationId);
  if (error || !data?.redirect_url) {
    redirect(
      `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}&error=failed`,
    );
  }
  redirect(data.redirect_url);
}

export async function approveAuthorization(formData: FormData): Promise<void> {
  await decide(formData, true);
}

export async function denyAuthorization(formData: FormData): Promise<void> {
  await decide(formData, false);
}
