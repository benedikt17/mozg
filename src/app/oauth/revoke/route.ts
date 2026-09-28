import { getMcpPublicUrl } from "@/lib/knowledge-mcp/oauth";
import {
  revokeMcpGrant,
  redirectUriForClient,
  validWorkClient,
} from "@/lib/knowledge-mcp/scoped-auth";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!getMcpPublicUrl())
    return new Response("Not configured", { status: 503 });
  if (
    !request.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
  )
    return Response.json({ error: "invalid_request" }, { status: 400 });
  const form = new URLSearchParams(await request.text());
  const clientId = form.get("client_id") ?? "";
  const redirectUri = redirectUriForClient(clientId);
  if (!redirectUri || !(await validWorkClient(clientId, redirectUri)))
    return Response.json({ error: "invalid_client" }, { status: 401 });
  const token = form.get("token") ?? "";
  if (token.length > 256)
    return Response.json({ error: "invalid_request" }, { status: 400 });
  await revokeMcpGrant(token, clientId);
  return new Response(null, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
