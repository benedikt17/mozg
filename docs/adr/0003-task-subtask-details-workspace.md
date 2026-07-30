# ADR 0003: Task Subtask Details Workspace

- Status: Accepted for first implementation
- Date: 2026-07-31

This ADR defines the first production-shaped prototype version of Markdown
explanations attached to structured subtasks in Task “Подробнее” mode. It is
not the final universal Task Detail Workspace architecture.

## Context

A structured subtask currently has a stable ID, a title, and a completion
state. The compact task card remains the fast operational interface. The
central Task “Подробнее” area additionally needs to let a user read and edit
Markdown explanations belonging to each exact subtask.

The card/details controls and the central Subtasks view must operate on one
subtask object. They must not maintain two independently synchronized copies.

The current snapshot contract is strict version 1. The current Knowledge
editor is a generic Markdown textarea, which is intentionally not promoted to
an unrestricted editor containing task headings, checkbox state, and
explanations together.

## Decision

The existing structured subtask remains the source of truth. For snapshot v2,
the subtask is conceptually extended as follows:

```ts
type TaskSubtask = {
  id: string;
  title: string;
  done: boolean;
  detailsMarkdown: string;
};
```

In the current prototype, explanatory text is added to the existing
`PrototypeSubtask` model during the implementation checkpoint; no code rename
is implied by this ADR.

The field semantics are:

- `id` is the stable identity.
- `title` is shared by the card and central view.
- `done` is shared by the card and central view.
- `detailsMarkdown` belongs to that exact subtask.
- Subtask order remains the order of the existing subtask array.
- Duplicate titles are allowed.
- Title text and Markdown line numbers are never identity.

The first version does not introduce a `TaskSubtaskDocument` collection, a
second Markdown copy of title/checkbox state, block IDs, or an
`ownerSubtaskId` relation. The central document is a structured projection of
the existing subtask array.

## Central representation

Reading mode visually presents one continuous document:

```text
[checkbox] Subtask title

Rendered Markdown explanation belonging to this subtask.

[checkbox] Next subtask title

Rendered Markdown explanation belonging to the next subtask.
```

Internally, every section is controlled by its structured subtask object. The
rendered checkbox and title are not reconstructed by parsing raw Markdown.

The first implementation’s editing mode will contain, for each section:

1. a controlled checkbox;
2. a controlled title;
3. a Markdown editor bound to `detailsMarkdown`.

The first version uses a constrained structured editor composed of
per-subtask sections. Safe Markdown renderer/editor primitives may be reused,
but identity remains outside Markdown.

## Creating subtasks in the central view

The first implementation will provide a dedicated new-subtask insertion
control in the central view. It may look visually similar to typing a new
top-level Markdown checkbox, but it is not a generic checkbox parser.

On successful creation in the first implementation:

- the client generates a new stable subtask ID;
- a new object is appended to the existing structured subtask array;
- `detailsMarkdown` starts as `""`;
- the new subtask immediately appears on the task card.

Arbitrary checkbox parsing inside an explanation textarea is not required for
the first implementation. A later explicit importer may accept pasted
top-level checkbox lists, with its own validation and tests.

## Checkbox rules inside explanations

`detailsMarkdown` is explanatory content, not another task database.

- Interactive Markdown checklist items are not supported inside it.
- A top-level task checkbox belongs to the structured subtask section.
- Checkbox-like text inside a fenced code block remains literal text.
- Ordinary bullet and numbered lists remain supported.
- Pasting arbitrary checkbox syntax into an explanation does not silently
  create subtasks.
- Any future checklist importer must be explicit and tested.

## Bidirectional behavior

Both surfaces dispatch domain actions against the same structured subtask.
There is no background synchronizer comparing two representations.

Card/details controls → central view:

- create: a new central section appears;
- rename: the central title updates;
- toggle completion: the central checkbox updates;
- delete: the section and its `detailsMarkdown` disappear;
- reorder: central section order changes.

Central view → card/details controls:

- create: a structured subtask is created;
- rename: the card title updates;
- toggle: the card checkbox updates;
- delete: the structured subtask is deleted;
- reorder: the existing subtask array order changes;
- edit explanation: only `detailsMarkdown` changes.

## Deletion rules

This checkpoint preserves current prototype deletion semantics and does not
introduce archiving.

- Deleting a subtask deletes its `detailsMarkdown` because it is part of the
  same object.
- If `detailsMarkdown` is non-empty, the UI requests explicit confirmation.
- Cancellation leaves the subtask and explanation unchanged.
- Task deletion removes nested subtasks and explanations through the existing
  task deletion lifecycle.
- No orphaned explanation record can exist because no separate document
  record exists.

The production archival rule remains a separate production concern and is not
silently changed by this prototype ADR.

## Text outside subtasks

The first version intentionally does not support arbitrary task-level Markdown
before, between, or after subtask sections.

- Every `detailsMarkdown` field belongs to one subtask.
- There are no intro/body/outro blocks.
- There is no `ownerSubtaskId: null` relation.
- There is no general Subtasks document text.
- Legacy `task.notes` is not migrated, reused, or removed by this feature.

A later ADR may introduce task-level materials after real usage proves the
need.

## Snapshot evolution

Adding `detailsMarkdown` is a persistent contract change. The first persistent
implementation therefore requires schema version 2.

Version 1 subtask:

```json
{
  "id": "...",
  "title": "...",
  "done": false
}
```

Version 2 subtask:

```json
{
  "id": "...",
  "title": "...",
  "done": false,
  "detailsMarkdown": ""
}
```

The v1 → v2 migration must be explicit and idempotent:

- every existing subtask receives `detailsMarkdown: ""`;
- task IDs, subtask IDs, titles, completion states, and array order remain
  unchanged;
- no separate document collection is generated;
- `task.notes` is untouched;
- existing Knowledge documents are untouched;
- IndexedDB and cloud snapshots use the same v2 domain contract;
- the v1 compatibility fixture remains available;
- implementation adds a v2 compatibility fixture;
- the client explicitly migrates v1 to v2;
- the strict v2 parser rejects unknown fields;
- a new migration adds the versioned v2 database validator;
- the existing v1 validator is not rewritten;
- a v2 stored snapshot cannot be overwritten by an old v1 client;
- no lossy automatic v2 → v1 downgrade is supported.

No part of this migration is implemented in the documentation checkpoint.

## Central workspace direction

The future central selection model is typed and ephemeral:

```ts
type TaskDetailPaneContent =
  | { kind: "subtasks"; taskId: string }
  | { kind: "knowledge"; documentId: string };
```

It is UI selection state, not persisted domain data in the first version. It
allows the central Task “Подробнее” area to display the current task’s
Subtasks view or one attached Knowledge article. Gallery and canvas variants
are future possibilities, not part of this ADR. This ADR defines no gallery,
canvas, or AI domain schemas.

## Task card interaction

The eventual UI adds a visible interactive `Подзадачи` label above the compact
subtask list. It uses the existing visual treatment of the `Статьи` and
`Ссылки` labels, opens the current task’s Subtasks view in the central area,
and remains available when the task has zero subtasks.

The existing compact checkbox presentation remains visually unchanged.
This is an accepted UI intent, not an implementation in this checkpoint.

## Toolbar scope

The eventual Subtasks central view may expose reading/editing mode, materials
sidebar visibility, sharing, Split, and a reserved AI slot. The staged scope
is deliberately smaller:

First usable version:

- Subtasks reading/editing view;
- no universal Split;
- no working share workflow unless an existing generic primitive is proven
  safe to reuse;
- AI absent or disabled;
- no gallery or canvas.

Later toolbar/Split work may extract reusable primitives from Knowledge,
support typed left/right content for Subtasks and Knowledge, and keep pane
state ephemeral. Knowledge Split must not be generalized during the first
Subtasks implementation.

## Conflict behavior

The first version uses the existing persistence runtime and CAS. It does not
introduce semantic merge or CRDT behavior.

- A CAS conflict blocks autosave according to the accepted persistence
  architecture.
- The user is informed that the server version won.
- The application must not silently merge explanations.
- Explicit reload/recovery UX is a separate checkpoint.
- Local unsaved `detailsMarkdown` remains local until the existing conflict
  workflow resolves it.
- Automatic merge by title, line number, or Markdown text is forbidden.

## Deferred features

The following are explicitly deferred:

- arbitrary raw Markdown as subtask identity source;
- typed universal block documents;
- block IDs;
- task-level free Markdown;
- checklist items inside explanations;
- bulk checklist import;
- semantic CAS merge;
- realtime collaboration and CRDT;
- gallery, image feed, and infinite canvas;
- AI writing or AI mutations;
- universal mixed-material Split;
- archival deletion model;
- production-normalized child-task rows;
- migration of legacy `task.notes`.

## Implementation checkpoints

### Checkpoint 1 — contract

This documentation checkpoint. No persistent schema change.

### Checkpoint 2 — snapshot v2 foundation

Extend subtask snapshot data with `detailsMarkdown`, implement v1 → v2
migration, add the strict v2 TypeScript parser, v1/v2 compatibility fixtures,
hydration tests, and local/cloud parity tests. Do not add product UI.

Persistent schema change: yes. A commit is required before continuing.

### Checkpoint 3 — database v2 boundary

Add a new Supabase migration, validate v2 snapshots, forbid v2 → v1
downgrade, preserve v1 validation for existing rows during controlled rollout,
and add RLS/CAS tests. Do not add product UI.

Persistent database contract change: yes. A commit is required before
continuing. Checkpoints 2 and 3 may be combined only if a later implementation
audit proves that splitting them creates an unsafe intermediate state.

### Checkpoint 4 — reducer and subtask details actions

Add create/update `detailsMarkdown`, shared create/rename/toggle/delete/reorder
semantics, confirmation state, reducer tests, and persistence tests. Do not
add the central workspace yet.

Persistent schema change: no additional version change. A commit is required.

### Checkpoint 5 — central Subtasks view

Add the interactive `Подзадачи` label, reading mode, constrained per-subtask
editing, central create/rename/toggle/reorder/delete, and the Markdown
explanation editor. Validate through manual local IndexedDB acceptance.

A commit is required.

### Checkpoint 6 — typed material selection and toolbar foundation

Add Subtasks/Knowledge central selection, reusable toolbar primitives,
reading/editing mode, materials sidebar visibility, and a reserved AI slot.
Do not add full universal Split unless separately accepted.

A commit is required.

### Checkpoint 7 — Split

Add a typed two-pane model for Subtasks + Knowledge and Knowledge + Knowledge
with independent ephemeral pane selection. Gallery and canvas remain out of
scope.

A commit is required.

## Consequences

Positive consequences:

- one source of truth for subtask identity, title, completion, and explanation;
- stable identity despite duplicate titles and Markdown edits;
- simple v1 → v2 migration;
- no orphan explanation records;
- card and central view cannot drift;
- limited first-version implementation risk;
- a future typed central workspace remains possible.

Negative consequences:

- no arbitrary free-form document layout;
- explanations cannot contain interactive nested checklists;
- no general text outside subtasks;
- one Markdown field per subtask may eventually become limiting;
- universal block editing would require a later ADR and migration.

## Rejected alternatives

### Raw Markdown as the source of truth

Rejected for the first version because it makes identity dependent on title,
line position, or hidden syntax and creates ambiguous paste, reorder, and
deletion behavior. It may be reconsidered only through a later contract ADR.

### Separate `TaskSubtaskDocument` with typed blocks

Rejected for the first version because it would duplicate the subtask
collection and introduce block ownership, block IDs, and synchronization rules
before the base workflow is proven. It remains a possible later evolution.

### Reusing `PrototypeDocument` as the Subtasks document

Rejected because Knowledge documents have different tree, linking, toolbar,
sharing, and checklist semantics. Reuse of safe rendering primitives remains
allowed; reuse of the Knowledge domain record does not.

### Normalized production child-task rows

Rejected for this prototype feature because it expands the scope into a
production task-schema migration. It remains a future production architecture
option and is not declared permanently impossible.

## Migration and architecture contradictions

This ADR does not modify `ARCHITECTURE.md` and does not change its frozen
decisions. The prototype snapshot’s embedded `PrototypeSubtask` is a local
prototype contract, not the production `tasks` schema. Before a production
implementation, the relationship between child subtasks and production task
rows must be decided in a separate architecture review.

The current prototype does not yet contain schema v2, central Subtasks
editing, or the interactive card label. Those are implementation checkpoints,
not claims about current behavior.
