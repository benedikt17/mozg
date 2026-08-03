# Infinite Canvas v0.1 — архитектурный контракт

- Статус: proposed for implementation checkpoints
- Дата: 2026-07-31
- Базовый commit аудита: `09c51f94d7729f704d7146d4277be9b9afa65a72`
- Применяется к: production-модулю Canvas, а не к текущей mock-реализации prototype

## 1. Executive decision

Canvas v0.1 — самостоятельный долгоживущий persistence domain внутри workspace.
Он хранит собственные документы, независимые ревизии, asset metadata и персональное
view state. Canvas не входит в `DesktopDomainSnapshot` v2 и не является причиной
создавать snapshot v3.

В v0.1 будут несколько холстов, task/article/text/image nodes, простые edges,
pan/zoom, выбор, drag/resize/z-order, локальное и облачное хранение, typed CAS
конфликт и безопасные broken references. Canvas не заменяет задачи, Knowledge,
Overview или Markdown-редактор.

На этом архитектурном checkpoint **ни одна Canvas-зависимость не одобрена и не
добавляется**. Первым engine checkpoint должен быть изолированный технический
spike, сравнивающий:

1. React Flow / `@xyflow/react` — default candidate;
2. `tldraw` — alternative candidate;
3. ограниченную внутреннюю реализацию — только если обе внешние опции не проходят
   конкретное обязательное требование.

React Flow — default candidate, потому что v0.1 прежде всего требует custom React
nodes, простые edges, pan/zoom, selection, drag, resize и controlled external
domain state. `tldraw` остаётся сильной freeform/asset alternative, но потребует
отдельного production-license approval, проверки license-key requirements,
ownership его internal store, adapter boundary и upgrade/migration risk assessment.
Spike не меняет persistence schema и должен быть disposable: его можно удалить,
не потеряв Canvas domain work. Canonical source of truth — `CanvasDocumentV1`, а не
library-specific store. Ни один engine record или snapshot не становится форматом
persistence MOZG.

## 2. Результат аудита и действующие ограничения

### Совместимость решения

Решение совместимо с текущим репозиторием при следующих границах:

- `DesktopDomainSnapshot` v2 содержит projects, Overview, task groups/lists/tasks,
  Knowledge folders и documents, но не canvases. Его строгий parser отклоняет
  неизвестные поля. Добавление Canvas в этот payload потребовало бы v3, увеличило
  бы область CAS-конфликта и противоречило этому контракту.
- Текущая cloud-персистенция уже использует отдельную server revision и typed CAS
  RPC `save_workspace_snapshot`; её шаблон применим к отдельному Canvas RPC.
- IndexedDB сейчас содержит один store `domain-snapshots` в базе
  `mozg-desktop-prototype`. Версию базы можно поднять только в Canvas checkpoint,
  добавив отдельные stores без изменения domain-snapshot envelope.
- Текущий `DesktopPrototypeState` — единый reducer. В нём есть старые mock
  `canvases`, canvas groups и selection, но `createDesktopDomainSnapshot` их
  намеренно не сериализует. Этот frozen prototype UI не удовлетворяет v0.1:
  у него процентные позиции, note/shape/link objects, нет asset lifecycle,
  edges, CAS, viewport или source references. Он не является production Canvas
  и не требует миграции пользовательских Canvas-данных.
- Задачи и Knowledge documents имеют строковые стабильные IDs в текущем snapshot.
  В целевой архитектуре `tasks.id` и `notes.id` остаются authoritative IDs;
  current `PrototypeDocument.id` — временный UI mapping для будущего article ID.
  Название никогда не используется для разрешения ссылки.
- `workspaces` и `workspace_members` уже являются security boundary; действуют RLS,
  составные workspace FK в нормализованной модели и browser-authenticated Supabase
  client. Service-role ключ клиенту не передаётся.
- Supabase выбран архитектурой для PostgreSQL, Auth и Storage. В текущих migrations
  нет Canvas tables, Storage bucket или asset metadata; это ожидаемый будущий
  migration checkpoint, а не несовместимость.
- В lockfile нет Canvas/graph engine. `ARCHITECTURE.md` упоминает tldraw как
  направление стека, но это не одобряет конкретную v0.1 реализацию: engine spike
  выше остаётся обязательным. Есть `@dnd-kit` только для task list DnD:
  он не предоставляет infinite world coordinates, node resize или edges и не
  годится как Canvas engine.
- Route `/prototype/desktop` и `DesktopPrototypeShell` уже client-side; Canvas UI
  должен быть изолированным client boundary/dynamic import без обращения к DOM,
  `window`, Clipboard или tldraw на сервере.

### Ключевые файлы, проверенные при аудите

- `ARCHITECTURE.md`, `AGENTS.md`, `src/prototype/AGENTS.override.md`;
- `package.json`, `pnpm-lock.yaml`, `vitest.config.ts`;
- `docs/adr/0001-cloud-snapshot-bridge.md`,
  `docs/adr/0002-desktop-snapshot-schema-evolution.md`,
  `docs/adr/0003-task-subtask-details-workspace.md`, `docs/PROTOTYPE_STATUS.md`;
- `src/prototype/desktop-shell.tsx`, `src/prototype/shell/section-rail.tsx`,
  `src/prototype/desktop-mock-data.ts`, `src/prototype/state/types.ts`,
  `src/prototype/state/desktop-state.ts`, `src/prototype/state/canvases-state.ts`;
- `src/prototype/canvases/canvases-sidebar.tsx`,
  `src/prototype/canvases/canvases-workspace.tsx`,
  `src/prototype/context-panels/context-panel-slot.tsx`;
- `src/prototype/tasks/tasks-dnd-context.tsx`, `src/prototype/dnd/vertical-dnd.ts`;
- `src/prototype/persistence/domain-snapshot.ts`, `persistence-adapter.ts`,
  `indexeddb-adapter.ts`, `desktop-persistence-runtime.ts`,
  `cloud-persistence-adapter.ts`, `cloud-snapshot-bridge.ts`,
  `use-desktop-persistence.ts`;
- `src/lib/supabase/browser.ts`, `server.ts`, `database.types.ts`,
  `desktop-snapshot-loader.ts`, `src/app/prototype/desktop/page.tsx`;
- все migrations в `supabase/migrations/` и RLS tests в `tests/rls/`;
- `tests/desktop-domain-snapshot.test.ts`, `desktop-snapshot-compatibility.test.ts`,
  `desktop-indexeddb-adapter.test.ts`, `desktop-persistence-runtime.test.ts`,
  `cloud-persistence-adapter.test.ts`, `cloud-snapshot-bridge.test.ts`,
  `desktop-persistence-selection.test.ts`, `desktop-prototype-overview-dnd.test.ts`.

`.env.local` не открывался.

## 3. Scope Canvas v0.1

В scope входят:

- верхнеуровневый раздел «Холсты», список нескольких Canvas, создание,
  переименование, открытие и soft-delete Canvas через `deleted_at`;
- бесконечное перемещение, zoom, selection, node movement/resize/z-order,
  простые directed edges;
- text, task reference, Knowledge article reference и image nodes;
- отдельные content revisions, cloud/local repositories и typed CAS conflict;
- персональные viewport/zoom/last opened Canvas, не влияющие на content revision;
- вставка PNG/JPEG/WebP drag-and-drop и clipboard (включая screenshot);
- безопасные missing/deleted reference cards и переход к исходной task/article.

Не входят: realtime/presence/CRDT, automatic merge, pen/drawing/shapes/frames/groups,
comments/history/AI/auto-layout, nested canvases, edge labels/ports/workflows,
полное редактирование task/article внутри node, Overview replacement, remote URLs,
Base64/Blob в Canvas JSON, универсальный block editor, SVG/HEIC/PDF/video,
mobile editing и animated GIF.

## 4. Decision record: почему не workspace snapshot v2/v3

`DesktopDomainSnapshot` — единый payload текущего workspace bridge. Его revision
изменяется при любом task/article изменении. Node drag может происходить десятки
раз за минуту; включение Canvas туда сделало бы независимые Canvas и задачи
конфликтующими сущностями. Snapshot parser v2 явно ограничивает допустимые
collections, поэтому Canvas в v2 технически недопустим, а v3 добавил бы migration
и широкую CAS область без доменной пользы.

Отдельный Canvas record даёт один CAS stream на Canvas: task edit не меняет Canvas
revision, node move не меняет workspace snapshot revision, а два stale tabs
конфликтуют только при записи одного Canvas. Поэтому v3 **не требуется**.

## 5. Ownership и TypeScript contract

Все IDs — opaque, client-generated UUID strings в production (никаких title-based
lookups). Для interoperability local/cloud используют идентичные ID и document
формат. `schemaVersion` таблицы и документа при записи равны `1`.

```ts
export type CanvasId = string;
export type CanvasNodeId = string;
export type CanvasEdgeId = string;
export type CanvasAssetId = string;

export type CanvasPoint = { x: number; y: number };
export type CanvasSize = { width: number; height: number };

export type CanvasDocumentV1 = {
  schemaVersion: 1;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export type CanvasNodeBase = {
  id: CanvasNodeId;
  position: CanvasPoint;
  size: CanvasSize;
  zIndex: number;
};

export type CanvasTaskNode = CanvasNodeBase & {
  kind: "task";
  taskId: string;
  /** Non-canonical display fallback, updated only after a successful resolution. */
  lastKnownTitle?: string;
};

export type CanvasArticleNode = CanvasNodeBase & {
  kind: "article";
  articleId: string;
  /** Non-canonical display fallback, updated only after a successful resolution. */
  lastKnownTitle?: string;
};

export type CanvasTextNode = CanvasNodeBase & {
  kind: "text";
  markdown: string;
};

export type CanvasImageNode = CanvasNodeBase & {
  kind: "image";
  assetId: CanvasAssetId;
  aspectRatioLocked: boolean;
};

export type CanvasNode =
  CanvasTaskNode | CanvasArticleNode | CanvasTextNode | CanvasImageNode;

export type CanvasEdge = {
  id: CanvasEdgeId;
  sourceNodeId: CanvasNodeId;
  targetNodeId: CanvasNodeId;
};

export type CanvasViewport = { x: number; y: number; zoom: number };

export type CanvasSummary = {
  id: CanvasId;
  workspaceId: string;
  title: string;
  revision: number;
  updatedAt: string;
};

export type LoadedCanvas = CanvasSummary & {
  schemaVersion: 1;
  document: CanvasDocumentV1;
};

export type SaveCanvasResult =
  | { status: "saved"; revision: number; updatedAt: string }
  | { status: "conflict"; revision: number };
```

Validation rejects non-finite coordinates, non-positive sizes, non-integer
`zIndex`, duplicate node/edge IDs, self-edge, duplicate source-target pairs and
an edge whose endpoints are absent. Persisted document validation must run in both
repositories and in the cloud write boundary. Unknown node kinds/schema versions
are unsupported, not silently discarded.

Task/article nodes retain only their stable source ID and optional non-authoritative
fallback title. They never copy completion, subtasks, task body, article Markdown
or preview into canonical Canvas content. Text nodes own their Markdown. Image
nodes own only layout and `assetId`, never a Base64 string, Blob, data URL or binary.

## 6. Cloud persistence model

The next schema checkpoint creates the following logical entities; SQL and migrations
are intentionally out of scope for this document.

| Entity               | Required fields                                                                                                                                                                                                   | Rules                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `canvases`           | `id`, `workspace_id`, `title`, `schema_version`, `document jsonb`, `revision bigint`, `created_by`, `created_at`, `updated_at`, `deleted_at`                                                                      | One independent content revision per Canvas. `workspace_id` immutable. User delete sets `deleted_at`. |
| `canvas_view_states` | `canvas_id`, `user_id`, `viewport_x`, `viewport_y`, `zoom`, `last_opened_at`, `updated_at`                                                                                                                        | Primary key `(canvas_id, user_id)`; personal data only.                                               |
| `canvas_assets`      | `id`, `workspace_id`, `canvas_id`, `storage_key`, `preview_storage_key nullable`, `mime_type`, `byte_size`, `width`, `height`, `checksum`, `created_by`, `created_at`, `ready_at nullable`, `deleted_at nullable` | Metadata for a private Canvas-scoped object; `(workspace_id, canvas_id)` is immutable.                |

`canvases` has a composite uniqueness target `(workspace_id, id)` so subsequent
Canvas-owned relations and validated source references cannot cross a workspace.
RLS follows the existing membership helpers: workspace member may read; the role
policy for create/update/delete follows the established owner/editor policy; anon
is denied. `created_by = auth.uid()` is set/verified server-side. New table,
function and Storage policies receive dedicated RLS tests before rollout.

Canvas deletion is soft deletion through `deleted_at`. Normal lists exclude deleted
rows; v0.1 has no user-facing archive/trash screen. The row and all associated
metadata remain restorable for 30 days, after which a controlled purge may physically
remove the Canvas and only then eligible asset records. Deleting a Canvas node is
immediate after normal confirmation and does not delete its source entity or asset.

### Canvas CAS

The write boundary is a security-definer or RLS-safe RPC with an authenticated user,
not a service-role client call:

```ts
save_canvas_document({
  canvasId: CanvasId,
  expectedRevision: number,
  title: string,
  schemaVersion: 1,
  document: CanvasDocumentV1,
}): Promise<SaveCanvasResult>;
```

It authorizes membership, validates the complete document, updates title/document/
schema/revision atomically only where `revision = expectedRevision`, increments the
revision once, and returns either `saved` with the new revision or `conflict` with
the current revision. Malformed documents, auth failures and availability failures
are typed errors distinct from the result union. A stale tab never retries with the
returned revision automatically: it reloads, presents the existing conflict UI
pattern, and lets the user choose the next action. There is no v0.1 auto-merge.

Create returns revision `1`; load returns full document and revision. Archive/delete
does not delete binaries synchronously. Updating Canvas A must not touch Canvas B or
the workspace snapshot.

### Personal view state

`upsert_canvas_view_state` validates finite `x/y` and a bounded zoom (recommended
`0.1..4`). It is separate from `save_canvas_document` and never increments content
revision. Ordinary last-write-wins is acceptable because this state is personal,
non-canonical and only controls a re-open convenience; it cannot erase Canvas
content. Debounce it after viewport settles and flush on unmount/visibility change.
The latest open Canvas can be represented by `last_opened_at` on the user's rows;
the newest valid row is the user's last opened Canvas.

## 7. Local parity and repository boundaries

Upgrade `mozg-desktop-prototype` only in its own migration step, adding separate
stores rather than inserting Canvas JSON into `domain-snapshots`:

- `canvases`, key `[workspaceId, canvasId]`: metadata, `CanvasDocumentV1`, local
  revision and saved timestamp;
- `canvas-view-states`, key `[workspaceId, userId, canvasId]`;
- `canvas-assets`, key `[workspaceId, assetId]`: metadata and Blob bytes;
- optional `canvas-upload-jobs`, key job ID: transient resumable local work only;
  it is never a Canvas document store.

Local mode uses the same validators, IDs and revisions. Its readwrite transaction
per Canvas performs the same expected-revision check and returns the same `saved` /
`conflict` result. This protects two local tabs where practical; it does not claim
to provide offline cloud synchronization. Cloud mode caches only confirmed cloud
Canvas data, as the existing snapshot runtime does.

```ts
export interface CanvasRepository {
  listCanvases(workspaceId: string): Promise<CanvasSummary[]>;
  createCanvas(input: {
    workspaceId: string;
    title: string;
  }): Promise<LoadedCanvas>;
  loadCanvas(input: {
    workspaceId: string;
    canvasId: CanvasId;
  }): Promise<LoadedCanvas>;
  saveCanvas(input: {
    workspaceId: string;
    canvasId: CanvasId;
    expectedRevision: number;
    title: string;
    document: CanvasDocumentV1;
  }): Promise<SaveCanvasResult>;
  deleteCanvas(input: {
    workspaceId: string;
    canvasId: CanvasId;
  }): Promise<void>;
  loadViewState(input: {
    workspaceId: string;
    userId: string;
    canvasId: CanvasId;
  }): Promise<CanvasViewport | null>;
  saveViewState(input: {
    workspaceId: string;
    userId: string;
    canvasId: CanvasId;
    viewport: CanvasViewport;
  }): Promise<void>;
}

export interface CanvasAssetRepository {
  storeImage(input: StoreCanvasImageInput): Promise<CanvasAsset>;
  loadImage(input: {
    workspaceId: string;
    assetId: CanvasAssetId;
  }): Promise<CanvasAssetSource>;
  markOrphanCandidate(input: {
    workspaceId: string;
    assetId: CanvasAssetId;
  }): Promise<void>;
}
```

`StoreCanvasImageInput`, `CanvasAsset`, and `CanvasAssetSource` are defined in the
asset checkpoint; their public representation exposes metadata and a Blob/object
URL or short-lived authenticated URL, never raw binary in `CanvasDocumentV1`.

## 8. Image asset contract

### Validation and formats

v0.1 accepts PNG, JPEG and WebP only. Validate both declared MIME type and decoded
image signature/dimensions; extension is advisory and a mismatch is rejected.
The application-level limits are configuration constants, not scattered magic
numbers:

```ts
export const CANVAS_IMAGE_LIMITS = {
  maxOriginalBytes: 20 * 1024 * 1024,
  maxDecodedMegapixels: 40,
  maxFilesPerOperation: 20,
  previewMaxLongSide: 2560,
} as const;
```

Reject corrupt images, unsupported Clipboard items and images that exceed any limit
before upload. The preview keeps the original asset and has a maximum long side of
approximately 2560 px.

GIF remains excluded. Supporting it as a static image needs a trusted first-frame
transform path; supporting animation introduces unbounded decode/UX/performance
semantics. Neither is a safe trivial v0.1 addition. SVG, HEIC, PDF, video and
external URLs remain excluded for the same validation and security reasons.

### Storage, authorization and URLs

Use a private Supabase Storage bucket named `canvas-assets`. Object keys are
deterministic and non-user-controlled:

```text
{workspaceId}/{canvasId}/{assetId}/original
{workspaceId}/{canvasId}/{assetId}/preview.webp   # only when a generated preview exists
```

Storage RLS uses the authoritative metadata row and permits only an authenticated
workspace member to read a ready asset for an active Canvas; owner/editor roles may
upload or delete through the lifecycle boundary. It denies public listing and
cross-workspace or cross-Canvas object access. `canvas_assets.storage_key` must
match this convention and be checked before the asset can be exposed. Browser
rendering obtains a short-lived signed URL after authenticated authorization (or an
authenticated download converted to an object URL); bucket objects are never
public URLs.

Initial preview policy: retain an optional nullable preview field. The preview
pipeline generates a bounded WebP preview after upload while preserving the original;
if preview generation is unavailable or fails, the editor safely falls back to the
original signed URL. The generation implementation must be isolated from the
Canvas JSON contract and retried independently.

### Upload, drop and paste lifecycle

For each accepted file:

1. Capture the drop point, convert screen coordinates via the engine viewport to
   Canvas world coordinates, and validate type/bytes/decoded dimensions.
2. Create a feature-local transient placeholder in state: `validating`, then
   `uploading`. It is not a `CanvasNode` and is not persisted in document JSON.
3. Generate `assetId`; upload the original private object, then persist validated
   `canvas_assets` metadata (and checksum). If metadata persistence fails, retry or
   mark the object for cleanup; do not add a node.
4. When metadata exists, mark the job `ready`, add the image node at the calculated
   world position and save the changed document through Canvas CAS.
5. On failure expose `failed`; retry reuses or creates an explicit asset attempt.
   User cancellation moves to `cancelled` and schedules cleanup of a completed but
   unreferenced upload.

Multiple dropped files are independently validated and laid out at deterministic
offsets from the same world point. A successful asset whose Canvas CAS write
conflicts remains an unreferenced asset candidate; it is never referenced by a
canonical stale document. A failed upload is never referenced by canonical JSON.

Clipboard handlers run only when Canvas owns focus and the target is not `input`,
`textarea`, `[contenteditable]`, Canvas title or text-node editing. Prefer the last
pointer world position within the Canvas; otherwise use the visible viewport centre.
Read all available image ClipboardItems/files to support screenshots and multi-image
paste, then apply the same pipeline as drop.

Deleting an image node removes only the Canvas node and its incident edges. It never
immediately deletes binary data because another Canvas may reference the asset.
Incomplete or failed upload objects may be cleaned after 24 hours. Ready assets that
become unreferenced are retained for at least 30 days; a scheduled cleanup job then
performs a reference audit across all non-deleted Canvas documents and deletes
metadata and both objects only if the audit is still empty. Cleanup is idempotent,
safe under retries and logged without exposing storage internals to the UI.

## 9. References, broken nodes and edge integrity

Task and article nodes resolve current source data on render within the same
workspace. Delete/archive of the source entity does not delete a Canvas node. The
node becomes a broken-reference card retaining node ID, source ID, position, size,
z-index, incident edges and `lastKnownTitle` when known. It offers only safe actions:
remove Canvas node or, if the source is restored later, open it. It never resolves
by title, so duplicate titles are harmless.

An edge remains valid when its task/article source disappears because both Canvas
nodes still exist. Deleting any Canvas node removes all of its incident edges in the
same document mutation. A malformed loaded edge whose source or target node is
missing is not rendered, is reported as recoverable invalid-document data, and is
removed only by an explicit repair/resave flow after user-visible notice; the loader
does not silently invent endpoints. New writes reject such documents.

## 10. State ownership and save boundaries

The narrow stable owner is a feature-local `CanvasSession` client controller:

- repository-loaded `LoadedCanvas` is the authoritative in-memory Canvas document;
- a local reducer/store owns selection, hover, marquee, active edge creation,
  context menu, keyboard modifiers, focused handle, upload jobs and drag/resize
  previews;
- the engine adapter owns only rendering/gesture state needed to project the document;
- workspace state supplies read-only task/article projections and navigation.

The global `desktopPrototypeReducer` must not receive pointer-move actions and must
not regain a `canvases` collection in `DesktopDomainSnapshot`. During drag/resize,
the engine updates a local preview at pointer frequency. Commit a document mutation
at pointer-up; keyboard nudge/text editing use a short debounced operation boundary.
One serial save coordinator folds completed local operations into a single CAS save
without dropping later changes. On conflict it freezes further content saves, retains
the unsaved local version for explicit recovery, and loads the current server version.

## 11. Engine spike and UI placement

No engine dependency is added by this architecture checkpoint. The first engine
checkpoint is a disposable technical spike comparing React Flow / `@xyflow/react`
and tldraw against the required capabilities: custom React shapes backed by
controlled external data, infinite pan/zoom, selection, drag/resize, z-order,
simple arrows, screen/world conversion, pointer/touch input, keyboard interaction,
and large-surface performance. A limited internal implementation is considered only
if both external candidates fail a concrete requirement.

The spike must use an in-memory `CanvasDocumentV1` fixture and semantic commands; it
must not alter persistence schema, repositories or production Canvas data. The
selected engine is decided in a separate checkpoint. If tldraw is selected, that
checkpoint explicitly approves its production license, checks license-key needs,
assesses internal-store ownership and upgrade/migration risk, and adds an adapter.
If React Flow is selected, the same adapter boundary prevents graph-library records
from becoming domain data. In either case, the adapter receives normalized
`CanvasDocumentV1` plus transient interaction commands and emits semantic mutations
(`moveNodes`, `resizeNode`, `setZOrder`, `upsertEdge`), never library snapshots.
The engine is loaded in a client-only boundary and no engine state crosses SSR.

«Холсты» is a top-level section beside Overview, Knowledge and Tasks. Its shell owns
the Canvas list and selection; opening a Canvas loads its independent repository.
The existing mock sidebar/workspace may guide placement but must be retired from the
production path rather than extended as the new domain model.

## 12. UX, accessibility and responsive contract

Desktop v0.1 interactions are: drag empty space to pan; wheel/trackpad pinch to
zoom; click and marquee to select; drag to move; visible resize handles; Delete or
Backspace to delete selected Canvas nodes (with confirmation only where destructive
context needs it); double-click text to edit; double-click task/article to open the
source; Ctrl/Cmd+V to paste eligible images; and file drop to insert at the drop
position. Save occurs after completed drag/resize, never per pointer event.

Canvas root is keyboard-focusable with clear instructions. Tab reaches canvas
toolbar, nodes and selected-node handles; arrow keys move a selected node by a
documented increment; Escape exits text editing, closes menus and returns focus to
the canvas; Enter opens a focused task/article. Text editing stops Canvas keyboard
shortcuts. Nodes and edge controls have descriptive accessible labels; decorative
edges are hidden from the tab order while selected edges expose a labelled control.

Full Canvas editing is desktop scope with a recommended minimum editing viewport of
approximately 900 CSS px wide. Narrow layouts must not compress the editor into an
unusable state: provide a safe read-only viewer or explicit unsupported-editing
state. Mobile editing, touch resizing and full mobile authoring are excluded from
v0.1. Respect `prefers-reduced-motion`; no inertial or animated
camera transition is required for essential feedback.

## 13. Performance and security boundaries

Start with a documented supported target of 500 nodes, 500 edges and 100 image nodes
per Canvas on a current desktop browser. Render viewport culling/engine
virtualization, avoid regenerating signed URLs every render, throttle view-state
writes and keep image decoding/uploads off pointer paths. Larger Canvas support is
measured before changing the target; v0.1 does not promise unbounded nodes.

Validate documents and image metadata at client and server boundaries; client checks
are UX, server checks are authoritative. Enforce workspace membership for every row,
RPC and Storage object; private assets never have public URLs; path segments and
MIME are not trusted from filenames; errors shown to users omit bucket keys, Supabase
payloads and credentials. Canvas text is rendered with the existing safe Markdown
policy and never as unsanitized HTML.

## 14. Migration and rollout sequence

No destructive migration is required. The current mock Canvas data is seed UI only
and never part of snapshot v2/cloud state, so it has no production data migration.
Future schema changes use new Supabase CLI migrations, regenerate DB types, add RLS
tests and are rolled out before enabling Canvas navigation for users.

1. Deploy schema/RLS/RPC and private bucket policies with Canvas navigation hidden.
2. Deploy repositories and a disabled shell, then validate signed uploads, CAS and
   cross-workspace denial in a staging workspace.
3. Enable the shell for an internal workspace; create/load/save/reload two Canvas
   tabs, upload/drop/paste images and test broken references.
4. Enable field-testing gradually. Monitor RPC conflicts, upload failure rate,
   storage usage, orphan cleanup and client render timing.
5. Keep a feature flag rollback that hides Canvas UI without deleting documents or
   assets. Schema and data are retained; rollback is not a destructive migration.

## 15. Checkpoint plan

Persistence foundation (cloud schema, RLS, validator, CAS and local repositories) is
library-independent and is completed before engine selection. Each checkpoint is one
branch and one PR; its commit/deployment decision remains a review gate. Branch names
below use the required `codex/` prefix.

| #   | Branch                                  | Scope                                                                | Explicit non-scope             | Tests / migration / browser acceptance / delivery                                                                       |
| --- | --------------------------------------- | -------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | `codex/canvas-v0-architecture-contract` | This contract.                                                       | Source, SQL, deps.             | Docs format + diff; no migration; no browser; no commit/deploy in this task.                                            |
| 2   | `codex/canvas-v0-cloud-cas-foundation`  | Tables, RPC, generated types, RLS.                                   | UI/assets/engine.              | SQL/RLS/RPC tests; migration yes; manual SQL smoke; commit, no production deploy without review.                        |
| 3   | `codex/canvas-v0-local-repositories`    | IndexedDB stores, validators, Canvas/viewport/asset repositories.    | Canvas UI/engine.              | Validator + IndexedDB CAS tests; migration no; browser local reload; commit.                                            |
| 4   | `codex/canvas-v0-engine-spike`          | Disposable React Flow vs tldraw capability spike.                    | Persistence schema/production. | Shared fixture/adapter tests; no migration; manual desktop spike; commit only as evidence.                              |
| 5   | `codex/canvas-v0-engine-decision`       | Select engine, license review, adapter contract and dependency plan. | Production shell/nodes.        | Decision record + compatibility tests; migration no; browser benchmark; commit after approval.                          |
| 6   | `codex/canvas-v0-navigation-shell`      | Top-level section, list/create/rename/soft-delete/open.              | Engine interactions.           | Component/repository tests; no migration; browser navigation; commit.                                                   |
| 7   | `codex/canvas-v0-layout`                | Pan/zoom, selection, move, resize, z-order and save boundaries.      | Text/reference/image/edges.    | Reducer/CAS tests; no migration; drag/resize browser acceptance; commit.                                                |
| 8   | `codex/canvas-v0-text-nodes`            | Canvas-owned Markdown text nodes.                                    | Task/article edits.            | Validation + editor focus tests; no migration; browser; commit.                                                         |
| 9   | `codex/canvas-v0-reference-nodes`       | Task/article nodes, navigation and broken cards.                     | Source-domain mutations.       | Resolver/broken-ref tests; no migration; browser; commit.                                                               |
| 10  | `codex/canvas-v0-assets`                | Bucket policy, metadata, previews and private binary storage.        | Drop/paste UI.                 | Storage RLS/repository tests; migration yes; signed URL browser smoke; commit/deploy review.                            |
| 11  | `codex/canvas-v0-image-ingest`          | Drop, paste, placeholders, retry/cancel and limits.                  | GIF/remote URL import.         | File/clipboard pipeline tests; no migration; browser manual acceptance; commit.                                         |
| 12  | `codex/canvas-v0-edges`                 | Create/delete/render simple edges and integrity repair.              | Labels/ports/routing.          | Document invariants + UI tests; no migration; browser; commit.                                                          |
| 13  | `codex/canvas-v0-hardening`             | Conflict UI, keyboard/a11y, responsive/performance, cleanup.         | Realtime/merge/mobile editing. | CAS, accessibility and load tests; cleanup migration only if schema needs it; browser acceptance; commit/deploy review. |
| 14  | `codex/canvas-v0-rollout`               | Feature flag, production migration/deploy/smoke.                     | New capability.                | Full applicable gates + manual smoke; migration only if pending; production release approval required.                  |

Estimated work: **14 focused coding-agent prompts**, one per checkpoint. The engine
spike and engine-decision prompts are deliberately separate so persistence work
remains reusable if both candidates fail or the selected dependency changes.

## 16. Testing strategy

Before each implementation PR, run the narrow relevant tests. The complete v0.1
set includes document validator fixtures; local and cloud repository conformance
tests sharing the same cases; one-Canvas CAS and two-stale-tabs conflicts; viewport
last-write-wins; workspace/RLS and Storage path denial; upload validation/failure/
retry/orphan cases; reference deletion and malformed-edge recovery; engine adapter
coordinate/drag/resize/z-order behavior; keyboard/focus/paste safety; and browser
smoke tests for pan/zoom/drop/paste/signed image reload.

Every database checkpoint additionally runs generated-type verification and
`pnpm test:rls`. No Canvas work changes the Markdown pipeline; if a text-node
Markdown renderer shares it later, the existing golden round-trip suite remains
mandatory. The final rollout runs applicable format, lint, typecheck, test, build,
RLS and `git diff --check` gates defined by `AGENTS.md`.

## 17. Risks and mitigations

| Risk                                          | Mitigation                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Canvas document leaks into workspace snapshot | Separate repository interfaces and strict snapshot parser tests.                       |
| Engine becomes data model                     | Persist only canonical `CanvasDocumentV2` in cloud; map through `CanvasEngineAdapter`. |
| Asset orphan/cost growth                      | Delayed reference-audited cleanup, checksum/metadata and monitoring.                   |
| Cross-workspace asset access                  | Private bucket, path convention, Storage RLS, table RLS and tests.                     |
| Drag causes excessive writes                  | Local previews; pointer-up/debounced semantic saves; one serial coordinator.           |
| Stale tab loses edits                         | Typed per-Canvas CAS, no automatic overwrite, explicit reload/recovery UI.             |
| Large images harm the browser                 | Decode/file/count limits and no animated formats.                                      |
| Existing mock Canvas is extended accidentally | Treat it as frozen prototype UI; production route uses new module only.                |

## 18. Remaining evidence questions

Product preferences resolved by this contract are: 30-day soft-delete retention
without an archive screen, the image limits and preview size above, desktop-only
editing with a narrow read-only/unsupported state, and groups/frames/nested canvases
as non-goals. Remaining questions require implementation evidence rather than a new
domain decision:

1. Which spike candidate meets the measured performance and accessibility target
   for the supported Canvas size without unacceptable lock-in?
2. If tldraw wins, what production license and license-key arrangement applies to
   the deployed MOZG plan, and what upgrade policy is acceptable?
3. Does the preview generator meet the 2560 px target within the agreed upload
   latency and storage budget, or should original-only fallback remain the default?
4. Which existing scheduled-job/runtime boundary should own the idempotent 24-hour
   failed-upload and 30-day unreferenced-asset cleanup?

## 19. Definition of Done for this documentation task

This document records the accepted separate persistence domain, cloud `CanvasDocumentV2`
contract, local V1-to-V2 read migration, cloud/local CAS model, private image lifecycle,
state/engine/UI boundaries, testing, rollout and checkpoints. It introduces no source
code, migration, dependency, production configuration, Auth change or deployment. It
preserves the Supabase, workspace and Markdown decisions; engine selection remains
gated by the disposable spike and the canonical library-independent Canvas contract.

## 20. Cloud CanvasDocumentV2 persistence checkpoint

The cloud persistence boundary is V2-only after the forward migration
`20260801120000_canvas_document_v2_persistence.sql`:

- cloud rows use `schema_version = 2` and canonical `CanvasDocumentV2` JSON;
- the PostgreSQL validator rejects V1 documents, unknown fields and invalid V2 edges;
- the existing create/save/delete RPC signatures and CAS result semantics remain stable;
- V1-to-V2 migration remains only at the TypeScript local/client repository boundary;
- server-side V1-to-V2 normalization and mixed V1/V2 cloud writes are not supported;
- an unexpected pre-existing V1 cloud row fails the migration closed and is never silently
  rewritten;
- viewport, asset metadata, Storage, binary lifecycle and the main MOZG UI remain outside
  this checkpoint.

## 21. Cloud repository and adapter checkpoint

The production-neutral cloud repository is an injected typed Supabase adapter. Its
public contract exposes workspace-scoped list/create/load/rename/delete operations,
strict V2 document CAS, and a separate authenticated viewport stream. It maps rows
into domain objects, never returns raw Supabase rows, and treats workspace or user
identity mismatches as server-contract failures.

- create uses `create_canvas` and refetches the canonical V2 row;
- load rejects V1 or malformed cloud documents without normalization;
- save uses `save_canvas_document` and returns the server's `saved` or `conflict`
  revision without retrying or guessing a next revision;
- rename uses only the narrow `rename_canvas` RPC and does not change document
  revision;
- delete uses only the existing soft-delete RPC;
- viewport state is upserted separately for the authenticated user;
- image `assetId` references remain supported in document JSON, while binary asset
  upload, download and Storage lifecycle remain outside this checkpoint;
- the main MOZG UI, local IndexedDB repository and local Canvas shell are not
  connected to cloud mode in this pass.

## 22. Cloud asset Storage checkpoint

The cloud asset foundation uses a private `canvas-assets` bucket and
Canvas-scoped metadata. Object keys are server-approved and deterministic:
`{workspaceId}/{canvasId}/{assetId}/original`, with an optional matching WebP
preview key. Bucket configuration limits uploads to PNG, JPEG and WebP with a
20 MiB object limit; decoded dimensions remain bounded at 10,000 px per side and
40 million pixels.

Metadata writes are RPC-only. The tested lifecycle is reserve metadata, upload
with `upsert: false`, finalize after the object exists, and clean up both sides
on failure. Delete removes the Storage object first and then soft-deletes
metadata; any incomplete cleanup is surfaced as a typed partial-failure error.

Canvas CAS accepts an image `assetId` only when the asset is ready, active, and
belongs to the same workspace and Canvas. Missing, pending, deleted, cross-Canvas
and cross-workspace references fail atomically. Storage URLs, Blobs and upload
state remain runtime-only and never enter `CanvasDocumentV2`; the local IndexedDB
Blob repository and the main UI remain unchanged.

## 23. Cloud Canvas runtime loading lifecycle

The desktop Cloud Canvas uses a client-only, bounded in-memory runtime cache for the
last active Canvas in a workspace. Its scope is the authenticated user and workspace;
it is never written to CanvasDocumentV2, desktop snapshots, localStorage, IndexedDB or
Supabase. Cache entries hold list summaries, loaded canonical document state and revision,
viewport, and bounded image render payloads/Object URLs. React Flow nodes and edges are
always reprojected from the cached canonical document; an engine snapshot is never a
cache or persistence format. The cache is cleared on an auth-user transition, workspace
eviction, explicit deletion of an asset projection and least-recently-used capacity
eviction; each clear revokes its object URLs.

The visible lifecycle is `list-loading`, `empty-confirmed`, `canvas-selected`,
`document-loading`, `skeleton-ready`, `content-hydrating`, `ready` or `error`.
The empty Canvas CTA is rendered only after a successful list request proves that the
workspace contains no Canvas. A cold open keeps the Canvas shell mounted, projects
canonical node geometry and edges immediately, and hydrates image binaries with bounded
parallel reads. Before canonical document and viewport are known, it shows only a neutral
Canvas surface, never invented placeholder nodes. Task projections continue to resolve
independently. The cloud desktop does not show a full-screen "Preparing canvas" overlay.

On return to Canvas, the last cached scene is restored without resetting its viewport or
object URLs while the list is revalidated in the background. An unchanged revision keeps
the runtime projection. A changed revision reloads the document only when the cached
state is saved; pending local changes enter the existing CAS conflict path and are never
silently merged. Image/task hydration can only update runtime payload; it cannot change
node IDs, positions or persisted bounds. React Flow mount measurement is ignored for
canonical persistence; only an explicit user resize may update saved geometry. This is a
runtime presentation policy, not a persistence or data-model change.
