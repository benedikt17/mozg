import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { getMcpPublicUrl } from "./oauth";

export const KNOWLEDGE_SCOPE = "knowledge:read";
export const NEUROCOMMENT_SCOPE =
  "knowledge:read knowledge:neurocomment:create";
export function normalizeKnowledgeScope(scope: string): string | null {
  const items = scope.trim().split(/\s+/u);
  if (items.length === 1 && items[0] === KNOWLEDGE_SCOPE)
    return KNOWLEDGE_SCOPE;
  return items.length === 2 &&
    new Set(items).size === 2 &&
    items.includes(KNOWLEDGE_SCOPE) &&
    items.includes("knowledge:neurocomment:create")
    ? NEUROCOMMENT_SCOPE
    : null;
}
export function validKnowledgeScope(scope: string): boolean {
  return normalizeKnowledgeScope(scope) !== null;
}
export const WORK_CLIENT_ID = "https://chatgpt.com/oauth/client.json";
export const WORK_REDIRECT_URI =
  "https://chatgpt.com/connector_platform_oauth_redirect";
export const CODEX_CLIENT_ID = "https://chatgpt.com/oauth/code/client.json";
export const CODEX_REDIRECT_URI = "https://chatgpt.com/connector/oauth/code";

export function redirectUriForClient(clientId: string): string | null {
  if (clientId === WORK_CLIENT_ID) return WORK_REDIRECT_URI;
  if (clientId === CODEX_CLIENT_ID) return CODEX_REDIRECT_URI;
  return null;
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!getMcpPublicUrl() || !key) throw new Error("MCP is not configured");
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function validPkceChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

export function matchesPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const actual = createHash("sha256").update(verifier).digest("base64url");
  return timingSafeEqual(Buffer.from(actual), Buffer.from(challenge));
}

export function validResource(resource: string): boolean {
  return resource === getMcpPublicUrl();
}

export async function validWorkClient(
  clientId: string,
  redirectUri: string,
): Promise<boolean> {
  if (redirectUriForClient(clientId) !== redirectUri) return false;
  try {
    const response = await fetch(clientId, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const metadata: unknown = await response.json();
    if (!metadata || typeof metadata !== "object") return false;
    const client = metadata as Record<string, unknown>;
    return (
      client.client_id === clientId &&
      Array.isArray(client.redirect_uris) &&
      client.redirect_uris.includes(redirectUri) &&
      Array.isArray(client.token_endpoint_auth_methods_supported) &&
      client.token_endpoint_auth_methods_supported.includes("none")
    );
  } catch {
    return false;
  }
}

export async function issueCode(options: {
  userId: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  challenge: string;
  scope?: string;
}): Promise<string> {
  const requestedScope = normalizeKnowledgeScope(
    options.scope ?? KNOWLEDGE_SCOPE,
  );
  if (!requestedScope) throw new Error("Unsupported MCP scope");
  const db = admin();
  const { data: grant, error: grantError } = await db
    .from("mcp_oauth_grants")
    .insert({
      user_id: options.userId,
      client_id: options.clientId,
      resource: options.resource,
      scope: requestedScope,
    })
    .select("id")
    .single();
  if (grantError || !grant) throw new Error("Cannot issue MCP grant");
  const code = newSecret();
  const { error } = await db.from("mcp_oauth_codes").insert({
    code_hash: hashSecret(code),
    grant_id: grant.id,
    redirect_uri: options.redirectUri,
    code_challenge: options.challenge,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
  if (error) {
    await db.from("mcp_oauth_grants").delete().eq("id", grant.id);
    throw new Error("Cannot issue MCP code");
  }
  return code;
}

type Grant = Database["public"]["Tables"]["mcp_oauth_grants"]["Row"];

async function activeGrant(id: string): Promise<Grant | null> {
  const { data } = await admin()
    .from("mcp_oauth_grants")
    .select("*")
    .eq("id", id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data && validKnowledgeScope(data.scope) && validResource(data.resource)
    ? data
    : null;
}

async function mintTokens(grant: Grant, includeRefresh: boolean) {
  const db = admin();
  const accessToken = `mozg_mcp_${newSecret()}`;
  const refreshToken = includeRefresh
    ? `mozg_mcp_refresh_${newSecret()}`
    : null;
  const accessExpiry = new Date(Date.now() + 15 * 60_000).toISOString();
  const { error: accessError } = await db.from("mcp_oauth_tokens").insert({
    token_hash: hashSecret(accessToken),
    grant_id: grant.id,
    kind: "access",
    expires_at: accessExpiry,
  });
  if (accessError) throw new Error("Cannot issue MCP access token");
  if (refreshToken) {
    const { error } = await db.from("mcp_oauth_tokens").insert({
      token_hash: hashSecret(refreshToken),
      grant_id: grant.id,
      kind: "refresh",
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
    });
    if (error) {
      await db
        .from("mcp_oauth_grants")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", grant.id);
      throw new Error("Cannot issue MCP refresh token");
    }
  }
  return {
    access_token: accessToken,
    token_type: "Bearer" as const,
    expires_in: 900,
    scope: grant.scope,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  };
}

export async function exchangeCode(options: {
  code: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  verifier: string;
  scope?: string;
}) {
  const db = admin();
  const { data: code } = await db
    .from("mcp_oauth_codes")
    .select("*")
    .eq("code_hash", hashSecret(options.code))
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!code || code.redirect_uri !== options.redirectUri) return null;
  const grant = await activeGrant(code.grant_id);
  if (
    !grant ||
    (options.scope && normalizeKnowledgeScope(options.scope) !== grant.scope) ||
    grant.client_id !== options.clientId ||
    grant.resource !== options.resource ||
    !matchesPkce(options.verifier, code.code_challenge)
  )
    return null;
  const { data: consumed } = await db
    .from("mcp_oauth_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("code_hash", code.code_hash)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("code_hash");
  if (consumed?.length !== 1) return null;
  return mintTokens(grant, true);
}

export async function refreshTokens(options: {
  token: string;
  clientId: string;
  resource: string;
  scope?: string;
}) {
  const db = admin();
  const hash = hashSecret(options.token);
  const { data: refresh } = await db
    .from("mcp_oauth_tokens")
    .select("*")
    .eq("token_hash", hash)
    .eq("kind", "refresh")
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!refresh) return null;
  const grant = await activeGrant(refresh.grant_id);
  if (
    !grant ||
    (options.scope && normalizeKnowledgeScope(options.scope) !== grant.scope) ||
    grant.client_id !== options.clientId ||
    grant.resource !== options.resource
  )
    return null;
  const { data: consumed } = await db
    .from("mcp_oauth_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("token_hash", hash)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("token_hash");
  if (consumed?.length !== 1) return null;
  return mintTokens(grant, true);
}

export async function verifyMcpAccess(
  token: string,
): Promise<{ userId: string; scope: string } | null> {
  if (!/^mozg_mcp_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { data } = await admin()
    .from("mcp_oauth_tokens")
    .select("grant_id")
    .eq("token_hash", hashSecret(token))
    .eq("kind", "access")
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  const grant = await activeGrant(data.grant_id);
  if (!grant) return null;
  const { data: auth, error } = await admin().auth.admin.getUserById(
    grant.user_id,
  );
  return !error && auth.user
    ? { userId: grant.user_id, scope: grant.scope }
    : null;
}

export async function verifyMcpToken(token: string): Promise<string | null> {
  return (await verifyMcpAccess(token))?.userId ?? null;
}

export async function revokeMcpGrant(
  token: string,
  clientId: string,
): Promise<void> {
  const db = admin();
  const { data } = await db
    .from("mcp_oauth_tokens")
    .select("grant_id")
    .eq("token_hash", hashSecret(token))
    .maybeSingle();
  if (!data) return;
  const grant = await activeGrant(data.grant_id);
  if (grant?.client_id === clientId)
    await db
      .from("mcp_oauth_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", grant.id);
}
