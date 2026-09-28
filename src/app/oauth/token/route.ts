import {
  exchangeCode,
  KNOWLEDGE_SCOPE,
  redirectUriForClient,
  refreshTokens,
  validResource,
  validWorkClient,
} from "@/lib/knowledge-mcp/scoped-auth";
import { getMcpPublicUrl } from "@/lib/knowledge-mcp/oauth";

export const runtime = "nodejs";

function errorResponse(error: string, status = 400): Response {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!getMcpPublicUrl()) return errorResponse("server_error", 503);
  if (
    !request.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
  )
    return errorResponse("invalid_request");
  let form: URLSearchParams;
  try {
    form = new URLSearchParams(await request.text());
  } catch {
    return errorResponse("invalid_request");
  }
  const clientId = form.get("client_id") ?? "";
  const resource = form.get("resource") ?? "";
  if (!validResource(resource)) return errorResponse("invalid_target");
  if (form.get("scope") && form.get("scope") !== KNOWLEDGE_SCOPE)
    return errorResponse("invalid_scope");
  if (form.get("client_secret") || form.get("client_assertion"))
    return errorResponse("invalid_client", 401);
  const kind = form.get("grant_type");
  if (kind === "authorization_code") {
    if (!(await validWorkClient(clientId, form.get("redirect_uri") ?? "")))
      return errorResponse("invalid_client", 401);
    const code = form.get("code") ?? "";
    const verifier = form.get("code_verifier") ?? "";
    if (code.length > 256 || verifier.length > 128)
      return errorResponse("invalid_request");
    const tokens = await exchangeCode({
      code,
      clientId,
      resource,
      redirectUri: form.get("redirect_uri") ?? "",
      verifier,
    });
    return tokens
      ? Response.json(tokens, { headers: { "Cache-Control": "no-store" } })
      : errorResponse("invalid_grant");
  }
  if (kind === "refresh_token") {
    const redirectUri = redirectUriForClient(clientId);
    if (!redirectUri || !(await validWorkClient(clientId, redirectUri)))
      return errorResponse("invalid_client", 401);
    const token = form.get("refresh_token") ?? "";
    if (token.length > 256) return errorResponse("invalid_request");
    const tokens = await refreshTokens({ token, clientId, resource });
    return tokens
      ? Response.json(tokens, { headers: { "Cache-Control": "no-store" } })
      : errorResponse("invalid_grant");
  }
  return errorResponse("unsupported_grant_type");
}
