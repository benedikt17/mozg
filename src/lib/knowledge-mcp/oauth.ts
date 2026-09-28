export function getMcpPublicUrl(): string | null {
  const configured = process.env.MOZG_MCP_PUBLIC_URL;
  // The old Supabase OAuth token would carry ordinary user write privileges.
  // Require the scoped credential implementation and server-only key.
  if (
    process.env.MOZG_MCP_SCOPED_AUTH !== "enabled" ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !configured
  )
    return null;
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
  const url = getMcpPublicUrl();
  if (!url) throw new Error("MCP is not configured");
  return new URL("/", url).href.replace(/\/$/, "");
}
