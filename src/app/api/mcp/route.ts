import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { loadKnowledgeForToken } from "@/lib/knowledge-mcp/load";
import { createKnowledgeMcpServer } from "@/lib/knowledge-mcp/server";
import { getMcpAuthChallenge } from "@/lib/knowledge-mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!getMcpAuthChallenge())
    return new Response("Not configured", { status: 503 });
  const match = /^Bearer ([^\s]+)$/i.exec(
    request.headers.get("authorization") ?? "",
  );
  if (!match) return unauthorized();
  const loaded = await loadKnowledgeForToken(match[1]);
  if (loaded.kind === "unauthorized") return unauthorized();
  if (loaded.kind !== "ready")
    return new Response("Knowledge unavailable", { status: 503 });

  const server = createKnowledgeMcpServer(loaded.snapshot);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": getMcpAuthChallenge() ?? "Bearer" },
  });
}

export async function GET(): Promise<Response> {
  return new Response("Method not allowed", { status: 405 });
}

export async function DELETE(): Promise<Response> {
  return new Response("Method not allowed", { status: 405 });
}
