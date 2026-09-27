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

## Connection status

The Preview login tests only the regular application. **Do not enable the
Supabase OAuth Server or set `MOZG_MCP_PUBLIC_URL` yet.** The existing OAuth
path would give an external client a Supabase user token. First implement and
test the scoped authorization boundary proposed in
[ADR-0006](adr/0006-knowledge-mcp-scoped-authorization.md), using an isolated
Preview environment with synthetic data. Then publish separate, verified
instructions for connecting ChatGPT Work.

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
