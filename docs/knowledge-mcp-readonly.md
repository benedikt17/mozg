# Read-only Knowledge MCP — first checkpoint

This checkpoint exposes **active Knowledge articles only**. It does not modify
the database, the workspace snapshot, tasks, files, or canvases. The endpoint
uses the existing workspace snapshot and accepts a Supabase user access token.
Every request validates the user with Supabase Auth and reads with that user's
JWT under the existing workspace RLS policies. No service-role key is used.

## Tools

- `list_knowledge_documents`: complete active-document inventory, paged up to
  50 items per call; follow `nextOffset` until null. Includes document/project
  IDs and folder paths. Counts and snapshot revision are returned.
- `search_knowledge_documents`: case-insensitive literal substring search in
  title, project, folder, and Markdown. Search is a convenience, not a
  comprehensive semantic contradiction detector.
- `read_knowledge_document`: original Markdown of one document ID, in chunks
  of up to 50,000 characters. Follow `nextOffset` until null to read the whole
  article, checking that `revision` stays the same across calls.

Each response carries the workspace snapshot revision and update time. If the
revision changes during a multi-call audit, repeat the audit on the newer
snapshot. Deleted articles are excluded. Text in Files/PDFs, Canvas, and task
cards is outside this checkpoint.

## Connection prerequisites

1. Deploy to an isolated Preview environment with its own Supabase project.
   Set `MOZG_MCP_PUBLIC_URL` to the exact Preview HTTPS URL ending `/api/mcp`.
   Without it, the endpoint and OAuth discovery are disabled (503).
2. In that Supabase project's Authentication → OAuth Server, enable the OAuth
   2.1 server. Set the authorization path to `/oauth/consent` and confirm its
   Site URL is the Preview application origin. Enable dynamic client
   registration only if the chosen MCP client needs it. Review the client
   presented on the consent page before approving. Keep the Production OAuth
   Server and `MOZG_MCP_PUBLIC_URL` disabled at this checkpoint.
3. Check `GET /.well-known/oauth-protected-resource`: its `resource` must be
   the exact MCP URL, and `authorization_servers` must point to the same
   Preview Supabase project. An unauthenticated `POST /api/mcp` must return
   `401` with a `WWW-Authenticate` challenge. Authenticated calls must be
   limited to the signed-in user's workspace.
4. Connect the URL through ChatGPT Work's developer/plugin flow and sign in
   with the existing MOZG account. Test with an account that cannot access
   another workspace. Verify list pagination and full Markdown against a few
   known articles before considering Production configuration.

No OAuth server setting, environment variable, plugin installation, or
Production data was changed by this code checkpoint. The draft PR creates an
automatic Vercel Preview deployment, but its MCP endpoint remains disabled.

## Security boundary before Production

The **MCP tools** are read-only. A Supabase OAuth access token, however, carries
the user's existing database permissions. Standard OAuth scopes such as
`openid` and `profile` do not reduce database permissions. An OAuth client that
obtains this token may call Supabase APIs directly, outside the MCP tools.
Therefore this PR must **not** be enabled against Production. The proposed
solution in [ADR-0006](adr/0006-knowledge-mcp-scoped-authorization.md) is to
issue a dedicated MCP-only credential instead of handing a Supabase user token
to the external client. This design has not been implemented yet. The consent
page and MCP endpoint stay disabled without an explicit
`MOZG_MCP_PUBLIC_URL` setting. An isolated Preview project with synthetic data
is the only supported place for the first OAuth connection test.

## Review before the next checkpoint

This endpoint has no tools for writing. Batch changes to Knowledge require a
separate design for approval, snapshot revision conflicts, recovery, and an
explicit user acceptance step.
