# ADR-0007: Knowledge neurocomments with explicit application

- Status: proposed
- Date: 2026-09-28

## Context

People annotate Knowledge articles and want their connected ChatGPT assistant
to review both the original Markdown and their comments. They also want the
assistant's suggestions to remain visually separate and to edit an article
only after a deliberate action in MOZG. A paid ChatGPT subscription can use
an authorized MCP connection; it does not supply an OpenAI API key for MOZG's
own in-app model calls.

## Decision proposed

Add an explicit `knowledge:neurocomment:create` OAuth capability alongside
`knowledge:read`. Existing read-only grants retain their old scope. The new
grant requires a fresh authorization and discloses that the assistant can
read the user's own comments and create agent comments. MCP never receives a
Supabase credential or direct article write tool.

Store agent suggestions in the existing annotations table with a distinct
`kind`, an exact unique Markdown quote, an optional replacement and the source
snapshot revision. Ordinary browser inserts and updates can create only human
comments. Agent creation requires the scoped MCP token, an owner membership,
an active article in the loaded snapshot, and a current revision. The new
comment reading tool returns only human comments authored by that user on an
active article; it does not expose teammates' notes.

The browser shows agent comments and proposed replacements in a separate
tab. Clicking **Внедрить** invokes a server-only transactional function. It
rechecks the signed-in user's ownership, exact snapshot revision, active
article and unique quote, replaces that single occurrence in Markdown,
increments the workspace snapshot revision and marks the suggestion applied.
Conflicts require a new review. It preserves the document title and all other
snapshot fields. Agent comments without a replacement remain notes.

## Consequences and rollout

- OAuth protected-resource and authorization metadata advertise both scopes;
  a new connection must request both. A client that requests only read keeps
  the original three tools.
- No external model key or model charge is needed for the MCP workflow. The
  reserved in-app chat requires a separate provider decision later.
- A schema migration and RLS tests must pass in isolated Preview before
  enabling the feature against Production data. No Production migration or
  OAuth setting is authorized by this ADR alone.
- Quoted text that appears twice is rejected; a comment anchored to Markdown
  syntax may be harder to highlight in the rendered article. The card still
  shows the exact before/after text for review.
