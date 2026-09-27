# Read-only Knowledge MCP — first checkpoint

This checkpoint exposes **active Knowledge articles only**. It does not modify
the database, the workspace snapshot, tasks, files, or canvases. The endpoint
uses the existing workspace snapshot. The external MCP client receives a
dedicated opaque access token, never a Supabase user token. Every request
validates that token, checks that the user still exists, and checks workspace
membership before a server-only client reads the snapshot. The server-only
service-role key is never sent to the client.

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

## Connection status

The Preview login tests only the regular application. **Do not enable the
Supabase OAuth Server or set `MOZG_MCP_PUBLIC_URL` yet.** The draft branch now
includes the scoped OAuth implementation proposed in
[ADR-0006](adr/0006-knowledge-mcp-scoped-authorization.md). Database and live
OAuth connection tests are still required. Test first on an isolated Preview
database with synthetic data. Then publish verified connection instructions.

No OAuth server setting, environment variable, plugin installation, or
Production data was changed by this code checkpoint. The draft PR creates an
automatic Vercel Preview deployment, but its MCP endpoint remains disabled.

## Security boundary before Production

Supabase OAuth tokens carry the user's existing database permissions, so the
old consent flow has been removed. The new authorization server issues only
dedicated tokens stored as hashes; they are accepted at `/api/mcp` and are not
Supabase JWTs. The server-only read path uses a service-role client after
checking the user's identity and workspace membership. The endpoint stays
disabled without **both** `MOZG_MCP_SCOPED_AUTH=enabled` and the exact
`MOZG_MCP_PUBLIC_URL`, plus the server-only `SUPABASE_SERVICE_ROLE_KEY`.

Only the official ChatGPT Work client metadata URL and callback are supported
at this stage. The remote MCP transport itself uses a standard protocol; other
clients can be added through an explicit client validation rule later. Do not
enable Production until the full OAuth and workspace boundary test passes.

## Review before the next checkpoint

This endpoint has no tools for writing. Batch changes to Knowledge require a
separate design for approval, snapshot revision conflicts, recovery, and an
explicit user acceptance step.
