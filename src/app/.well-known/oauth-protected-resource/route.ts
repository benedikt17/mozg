import {
  getMcpAuthorizationServer,
  getMcpPublicUrl,
} from "@/lib/knowledge-mcp/oauth";

export function GET(): Response {
  const resource = getMcpPublicUrl();
  if (!resource) return new Response("Not configured", { status: 503 });
  return Response.json(
    {
      resource,
      authorization_servers: [getMcpAuthorizationServer()],
      scopes_supported: ["knowledge:read"],
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
