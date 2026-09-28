# ADR-0006: Scoped authorization for Knowledge MCP

- Status: proposed
- Date: 2026-09-27

## Context

The initial Knowledge MCP implementation offers only list, search, and read
tools, and remains disabled until `MOZG_MCP_PUBLIC_URL` is configured. Its
proposed OAuth flow gives an external client a Supabase user access token.
Supabase OAuth scopes such as `openid` and `profile` control identity fields,
not database or Storage permissions. A client holding this token can bypass
the MCP endpoint and call Supabase APIs with the user's existing permissions.
The current database also exposes write paths through RLS and privileged RPCs.

The desired initial grant is narrower: an external assistant may read the
current user's Knowledge Markdown but cannot write to MOZG or access unrelated
workspace data through the credential used for MCP.

## Decision proposed

Use a separate OAuth authorization boundary for the remote MCP endpoint. The
external client receives a credential valid **only for MOZG MCP**; it must
never receive a Supabase access or refresh token, a service-role key, or a
credential accepted by Supabase Data API, RPC, or Storage.

The MOZG server authenticates the user with the existing browser session when
the user approves the OAuth request. A durable server-side grant records the
user, client, permitted `knowledge:read` capability, expiry, and revocation
state. The server issues an opaque, short-lived access token for that grant.
For each MCP request it verifies that token and its audience, capability,
expiry, and revocation; then it reads Knowledge under the user's existing
workspace authorization. Supabase credentials, if required for that read, stay
server-side. The read path must preserve workspace RLS or enforce the same
membership and role rules before any privileged database query.

The authorization server must implement the OAuth features required by the
actual Work connection, including authorization-code with PKCE, client
registration or a supported fixed client, token exchange, refresh and
revocation, protected resource metadata, and redirect URI validation. Its
grants and tokens require persistent storage; Vercel function memory cannot
serve as the source of truth. Do not copy Production Knowledge into Preview to
test this flow; use synthetic Preview data.

Keep the existing Supabase OAuth proposal disabled in all environments while
this boundary is implemented and tested. Remove or replace that flow before
enabling a connection to Production.

## Alternatives considered

1. **Reuse Supabase OAuth and add `client_id` restrictions to every write
   boundary.** This requires a complete inventory and regression tests for
   table RLS, Storage policies, and privileged public RPCs. Missing one path
   can permit writes. It also broadens the scope of a first read-only MCP
   release and touches Production database authorization.
2. **Use the current read-only tools with unrestricted Supabase OAuth.** This
   does not prevent the OAuth client from using the token directly against
   Supabase and fails the read-only guarantee.
3. **Give a personal Supabase API key or service-role key to the client.**
   Such credentials have broader privileges and are unsuitable for this use.

## Consequences

- Users see a familiar MOZG login and an explicit Knowledge-only consent.
- MCP credentials are useless against Supabase APIs even if leaked to the
  client; they remain sensitive because they authorize Knowledge reads.
- Server-side grant storage, token rotation and revocation, auditability, and
  OAuth compliance add implementation work. Cross-workspace denial and
  ordinary browser editing need end-to-end regression tests.
- This ADR proposes the authentication boundary; it does not authorize a
  migration or enable the endpoint. Keep the draft PR unmerged until the
  implementation and tests exist.

## Migration plan

1. Build a dedicated, persistent OAuth grant/token store in an isolated
   Preview database with synthetic user and Knowledge documents.
2. Replace Supabase OAuth discovery, consent actions, and bearer validation
   with the dedicated authorization server and scoped token checks.
3. Demonstrate OAuth login, reconnect, refresh and revocation, all Knowledge
   pages, cross-workspace denial, and direct Supabase API rejection of the
   _MCP token_. Verify ordinary MOZG editing still works.
4. Repeat the security review and tests before making any Production setting
   changes. Enable Production only after a separate explicit acceptance of
   the completed implementation.

## References

- Supabase, Token Security and Row Level Security:
  https://supabase.com/docs/guides/auth/oauth-server/token-security
- OpenAI, Build an MCP server:
  https://developers.openai.com/plugins/build/mcp-server
