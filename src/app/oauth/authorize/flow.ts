import {
  KNOWLEDGE_SCOPE,
  validKnowledgeScope,
  normalizeKnowledgeScope,
  validPkceChallenge,
  validResource,
  validWorkClient,
} from "@/lib/knowledge-mcp/scoped-auth";

export type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  resource: string;
  challenge: string;
  state: string;
  scope: string;
};

export async function validateAuthorizationRequest(
  params: URLSearchParams,
): Promise<AuthorizationRequest | null> {
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const resource = params.get("resource") ?? "";
  const challenge = params.get("code_challenge") ?? "";
  const state = params.get("state") ?? "";
  if (
    params.get("response_type") !== "code" ||
    params.get("code_challenge_method") !== "S256" ||
    !validKnowledgeScope(params.get("scope") ?? KNOWLEDGE_SCOPE) ||
    !validResource(resource) ||
    !validPkceChallenge(challenge) ||
    state.length > 512 ||
    !(await validWorkClient(clientId, redirectUri))
  )
    return null;
  return {
    clientId,
    redirectUri,
    resource,
    challenge,
    state,
    scope: normalizeKnowledgeScope(params.get("scope") ?? KNOWLEDGE_SCOPE)!,
  };
}
