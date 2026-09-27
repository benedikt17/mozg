import { getPublicEnv } from "@/lib/env";

export function getMcpPublicUrl(): string | null {
  const configured = process.env.MOZG_MCP_PUBLIC_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.pathname !== "/api/mcp" || url.search || url.hash) return null;
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function getMcpAuthChallenge(): string | null {
  const url = getMcpPublicUrl();
  if (!url) return null;
  return `Bearer resource_metadata="${new URL("/.well-known/oauth-protected-resource", url).href}"`;
}

export function getMcpAuthorizationServer(): string {
  return `${getPublicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/auth/v1`;
}
