import {
  getMcpAuthorizationServer,
  getMcpPublicUrl,
} from "@/lib/knowledge-mcp/oauth";

export function GET(): Response {
  if (!getMcpPublicUrl())
    return new Response("Not configured", { status: 503 });
  const issuer = getMcpAuthorizationServer();
  return Response.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      client_id_metadata_document_supported: true,
      token_endpoint_auth_methods_supported: ["none"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["knowledge:read"],
      authorization_response_iss_parameter_supported: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
