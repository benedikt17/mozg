# ADR-0005: Project Files as a shared asset layer

- Status: accepted
- Date: 2026-08-13

## Context

MOZG already has a working private Supabase Storage pipeline for Canvas images. `canvas_assets` keeps authoritative metadata for the uploaded source object and `canvas_asset_variants` keeps derived WebP variants such as thumbnails, previews and edge-sized representations. The original PNG/JPEG is preserved as an independent Storage object; derived variants are display caches rather than a replacement for the source.

The product now needs a simple project file manager: folders, upload, image preview, search, rename/move, original download, trash and later controlled sharing. The long-term requirement is more important than the raw storage volume: Canvas, Tasks and Knowledge should be able to refer to the same physical user file instead of creating domain-owned copies.

Creating a second unrelated file system beside `canvas_assets` would preserve a structural problem: each product domain would own its own physical binary and cross-domain reuse would imply copying. Reusing `canvas_assets` as the universal model would create the opposite problem: a general file would inherit Canvas ownership, Canvas lifecycle and Canvas-specific path semantics.

There is also a current project-identity constraint. Desktop Snapshot V3 is the authoritative source for Product Projects. Current Product Project identifiers are opaque text ids such as `lukomorie`; they are not rows in the legacy `public.projects` UUID table. This is already the accepted Canvas project-scope model. Files must not re-introduce a competing project identity model.

## Decision

### 1. Files is a Project-scoped persistence domain

Introduce a standalone `Files` domain. A file belongs to exactly one current Product Project and one workspace.

The initial domain model is:

```text
Workspace
└── Project
    └── Files
        ├── project_folders
        ├── project_files
        └── file_variants
```

`project_files.id` is the durable asset identity that other MOZG domains will reference in later stages.

For the current Desktop Snapshot architecture:

```text
workspace_id uuid
project_id   text
```

`project_id` is the opaque Desktop Snapshot Project id. It is intentionally not a foreign key to `public.projects(id uuid)` while Desktop Snapshot V3 remains authoritative for Product Projects. Files follows the same project identity contract already enforced for Canvas.

Folder hierarchy and file-to-folder membership must enforce both `workspace_id` and `project_id`. RLS remains the authorization boundary for workspace membership and roles. Storage object paths are not an authorization source.

### 2. Target metadata model

`project_folders`:

```text
id
workspace_id
project_id
parent_folder_id nullable
name
sort_order
created_by
created_at
updated_at
deleted_at
```

`project_files`:

```text
id
workspace_id
project_id
folder_id nullable
name
original_name
storage_key
mime_type
byte_size
checksum nullable
width nullable
height nullable
created_by
created_at
updated_at
ready_at nullable
deleted_at
```

`file_variants`:

```text
workspace_id
project_id
file_id
kind
storage_path
mime_type
byte_size
pixel_width nullable
pixel_height nullable
target_max_edge nullable
created_at
ready_at nullable
```

Image dimensions are nullable because the Files domain is not restricted to images. Additional type-specific metadata must not be added to the base table until a real use case requires it.

The schema migration may refine indexes, constraints and exact variant keys, but it must preserve the ownership and lifecycle rules in this ADR.

### 3. Originals are immutable user assets; variants are disposable caches

The uploaded source is preserved byte-for-byte as the canonical physical asset. The original user filename is stored separately in `original_name`. Renaming a file in MOZG changes display metadata and never rewrites or re-encodes the original object.

For images, thumbnails/previews/multiresolution edge variants may be generated for efficient UI and Canvas use. They are derived caches and may be regenerated from the original. Deleting or rebuilding a derived variant must not affect the source file.

```text
original
→ metadata
→ derived preview/cache variants
```

### 4. Storage is private and object keys are stable

Create a separate private Supabase Storage bucket, initially named:

```text
project-files
```

A stable path shape is preferred:

```text
{workspace_id}/{file_id}/original
{workspace_id}/{file_id}/variants/{variant-name}
```

Folder names, user filenames and Project names do not belong in the physical object key. Rename and folder move are metadata-only operations and do not require Storage object moves. Project authorization is resolved from `project_files` metadata rather than trusted from a path segment.

Storage policies must validate the authoritative metadata row plus workspace membership/role. They must not grant access merely because a caller can compose a plausible object path.

The bucket remains private. Public bucket access is not an accepted sharing mechanism.

### 5. Uploads use reserve → upload → finalize semantics

A new file is first reserved in metadata, then its Storage object is uploaded, then metadata is finalized after Storage verifies the uploaded object's MIME type and byte size; `ready_at` marks the file as readable through normal Files paths.

`checksum` is optional integrity metadata in Stage A1. The current browser path may provide it during reservation, but finalize does not independently recompute or prove that checksum. Code must not treat a non-null checksum as server-verified integrity evidence unless a later trusted implementation explicitly computes or compares it against the stored object.

Pending rows are visible only where required for the uploader/editor workflow. Normal read paths only expose ready, non-deleted files.

The implementation can reuse proven Canvas asset repository patterns, but Files is a separate repository/domain rather than an alias around `canvas_assets`.

### 6. Files gets its own size and MIME policy

The current `canvas-assets` 20 MB bucket limit and image-only allowlist are Canvas-specific and must not be copied automatically to Files.

Stage A must define an explicit Files upload policy. Small browser uploads may use the normal Storage path; larger source assets must use a resumable upload path. The policy must be enforced at both the UX boundary and the trusted server/storage boundary.

No broad PSD/TIFF/ZIP/video support is implied by this ADR. Those formats can be added deliberately once their upload, preview and size requirements are specified.

### 7. Deletion is soft by default

User deletion sets `deleted_at`; it does not immediately destroy the original Storage object. Deleted files disappear from ordinary listing/search and can be restored while retained.

Physical purge is a separate owner/admin cleanup operation with an explicit retention policy. Derived variants follow the lifecycle of their parent file.

### 8. Sharing never makes the bucket public

Stage A does not require public sharing. When sharing is added, use either:

- short-lived signed URLs; or
- an application-level share record/token such as `/share/file/<token>` with expiry/revocation semantics.

Long-lived application sharing must be revocable and must not expose Storage credentials or turn `project-files` into a public bucket.

### 9. Cross-domain reuse is by reference, not by copy

```text
Canvas / Tasks / Knowledge
        ↓
      file_id
        ↓
   project_files
        ↓
  original + variants
```

A domain-specific association can carry presentation or relationship metadata, but it must not create a second physical copy merely because the same file is used by another MOZG module.

A universal polymorphic `file_references` table is not introduced in Stage A. Each integration stage should add the narrow reference contract it actually needs.

## Rollout

### Stage A — standalone Files

Build the Files domain independently:

- `project_folders`, `project_files`, `file_variants`;
- private `project-files` bucket;
- RLS and Storage policies;
- typed repository boundary;
- folders;
- upload;
- preview;
- search;
- rename/move;
- original download;
- soft-delete/trash.

Existing Canvas behavior and `canvas_assets` remain unchanged.

### Stage B — Files → Canvas

Canvas gains an explicit “add from MOZG Files” flow. A Canvas image node may reference a ready `project_file` from the same workspace and Project.

No legacy migration is required for this stage.

### Stage C — new Canvas uploads register in Files

New direct Canvas image uploads become Files assets and Canvas stores a reference to the shared file identity. Canvas-specific presentation state remains in the Canvas domain; physical asset ownership moves to Files for new uploads.

The old Canvas upload path remains only as a compatibility boundary while this stage is being rolled out.

### Stage D — legacy Canvas assets

Only after Stages A–C are validated decide whether existing `canvas_assets` should be migrated or left as a legacy compatibility store.

There is no eager migration. Existing Canvas originals are not copied, moved or deleted merely to launch Files.

Any legacy migration must be idempotent, preserve checksums/source bytes, keep Canvas references valid throughout rollout and have an explicit rollback or compatibility plan.

## Alternatives considered

### Extend `canvas_assets` into the general file table

Rejected. It couples general Files to Canvas ownership, Canvas lifecycle and Canvas-scoped object paths, and makes a non-Canvas file conceptually dependent on a Canvas.

### Keep Files and Canvas as permanently separate binary stores

Rejected as the target architecture. It makes reuse across Canvas, Tasks and Knowledge copy-based and creates parallel image pipelines with duplicated storage and metadata semantics.

### Reuse the historical `attachments` model

Rejected as the new canonical asset layer. The historical attachment contract predates the current Canvas asset pipeline and does not express the required Project-scoped file manager, derived variants or staged migration boundary.

### Use a second storage provider immediately

Rejected for the initial rollout. Supabase already provides Auth, RLS, PostgreSQL and Storage for MOZG, and expected volume does not justify a second provider boundary now. An S3-compatible provider remains a future optimization if storage scale or external download traffic makes it valuable.

### Public bucket plus obscure URLs

Rejected. Access control and sharing must remain explicit and revocable.

### Migrate all existing Canvas assets before Files launches

Rejected. It adds migration risk before the new domain has been validated and provides no user benefit required for Stage A.

## Consequences

Positive:

- one durable asset identity can later serve Files, Canvas, Tasks and Knowledge;
- originals remain lossless while previews stay fast;
- file/folder rename and move do not rewrite Storage objects;
- existing Supabase/Auth/RLS infrastructure is reused;
- Canvas legacy data can remain untouched while the new system proves itself;
- future storage-provider changes can be isolated behind a typed repository boundary instead of leaking through product domains.

Costs and trade-offs:

- during Stages A–C, two asset systems coexist temporarily;
- image variant generation must be generalized or shared without making Files depend on the Canvas UI domain;
- current `project_id text` is a transitional Product Project identity contract; a future migration from Desktop Snapshot projects to canonical database Projects must migrate Files and Canvas consistently;
- trash retention and physical purge require a later operational policy;
- large-file limits and supported MIME classes need an explicit Stage A product decision rather than inheriting Canvas defaults.

## Migration plan

1. Accept this ADR and update `ARCHITECTURE.md` to add Files as a canonical Project-scoped domain and shared asset direction.
2. Create the Stage A schema and private bucket in a new Supabase migration; update generated DB types and RLS tests.
3. Implement the typed Files repository and standalone Files UI without reading or mutating legacy `canvas_assets`.
4. Validate original-byte preservation, workspace/Project isolation, folder hierarchy, trash behavior, upload/finalize failure recovery and download.
5. Add Files → Canvas references as a separate integration stage.
6. Switch only new Canvas uploads to the shared Files asset layer after the reference path is proven.
7. Evaluate legacy Canvas migration last; do not perform it automatically.

No existing user data migration is required for Stage A.

## Non-goals of this ADR

- Dropbox/Google Drive desktop sync;
- Office-like document editing;
- complex per-file ACLs;
- file version history;
- realtime collaborative file editing;
- immediate migration of legacy Canvas assets;
- final policy for every large source format;
- public anonymous Storage access.
