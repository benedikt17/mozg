"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getMcpAuthorizationServer,
  getMcpPublicUrl,
} from "@/lib/knowledge-mcp/oauth";
import { issueCode } from "@/lib/knowledge-mcp/scoped-auth";
import { validateAuthorizationRequest } from "./flow";

async function decide(form: FormData, allow: boolean): Promise<void> {
  if (!getMcpPublicUrl()) redirect("/oauth/authorize?error=disabled");
  const params = new URLSearchParams();
  for (const key of [
    "client_id",
    "redirect_uri",
    "resource",
    "code_challenge",
    "code_challenge_method",
    "response_type",
    "scope",
    "state",
  ]) {
    const value = form.get(key);
    if (typeof value === "string") params.set(key, value);
  }
  const request = await validateAuthorizationRequest(params);
  if (!request) redirect("/oauth/authorize?error=invalid");
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/oauth/authorize?${params}`)}`,
    );
  const target = new URL(request.redirectUri);
  if (allow) {
    const code = await issueCode({
      userId: user.id,
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      resource: request.resource,
      challenge: request.challenge,
    });
    target.searchParams.set("code", code);
  } else target.searchParams.set("error", "access_denied");
  if (request.state) target.searchParams.set("state", request.state);
  target.searchParams.set("iss", getMcpAuthorizationServer());
  redirect(target.href);
}

export async function approveMcpAccess(form: FormData): Promise<void> {
  await decide(form, true);
}

export async function denyMcpAccess(form: FormData): Promise<void> {
  await decide(form, false);
}
