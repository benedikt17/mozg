# ADR-0004: Infinite Canvas как независимый persistence domain

- Status: Accepted
- Date: 2026-07-31

## Context

`ARCHITECTURE.md` содержит раннее предложение Canvas, в котором Canvas был
привязан к `project_id`, хранил tldraw snapshot в `document`, использовал
`archived_at` и общую таблицу `attachments`. Принятый контракт
`docs/infinite-canvas-v0-architecture.md` задаёт другую границу: Canvas —
отдельный workspace-scoped persistence domain с независимым CAS, строгим
`CanvasDocumentV1`, отдельным view state и метаданными `canvas_assets`.

Без явного решения эти документы оставляют две конкурирующие active-модели и
делают небезопасным следующий migration checkpoint.

## Decision

Для всех новых Infinite Canvas v0.1 implementation checkpoints действует
контракт из [`docs/infinite-canvas-v0-architecture.md`](../infinite-canvas-v0-architecture.md).
Он supersedes только legacy Canvas-specific sections of
[`ARCHITECTURE.md`](../../ARCHITECTURE.md), а не unrelated architecture,
включая модели tasks, Knowledge, workspace snapshots, Auth, RLS или Markdown.

Конфликты разрешаются следующим образом:

| Legacy contract                       | Accepted contract                                            |
| ------------------------------------- | ------------------------------------------------------------ |
| `project_id`                          | `workspace_id`; Canvas не является дочерним объектом project |
| `name`                                | `title`                                                      |
| `archived_at`                         | `deleted_at` для soft-delete Canvas                          |
| tldraw snapshot как canonical content | строгий `CanvasDocumentV1`                                   |
| `attachments`                         | `canvas_assets` и private object storage                     |
| library-specific persistence          | library-independent Canvas domain model                      |
| viewport внутри editor/store content  | отдельный personal `canvas_view_states`                      |
| engine assumed in persistence         | engine выбирается только после disposable spike              |

Canvas не входит в workspace snapshot v2/v3; snapshot v3 для Canvas не требуется.
Текущий Canvas mock остаётся frozen non-production placeholder. Ни React Flow, ни
tldraw, ни другой engine не одобрен как production dependency этим решением;
library snapshots не являются форматом persistence MOZG.

## Superseded legacy decisions

Следующие Canvas-specific решения из `ARCHITECTURE.md` superseded и не должны
использоваться для новых реализаций:

- schema `canvases` с `project_id`, `name`, `archived_at`, `share_token` и
  tldraw-store `document`;
- обязательная строка Canvas в `attachments` и attachment path как источник
  Canvas asset metadata;
- предположение, что tldraw уже выбран и является canonical Canvas store.

Упоминания этих решений в историческом changelog или в описании ещё не
реализованных общих механизмов не меняют их статуса.

## Consequences

- Canvas migration получает собственные tables, RLS, typed CAS и generated types.
- Canvas title, document revision, soft-delete и personal viewport имеют
  независимые lifecycle boundaries.
- Image binary никогда не попадает в Canvas JSON; asset cleanup и preview
  pipeline развиваются отдельно от Canvas document.
- Engine spike можно удалить или заменить без migration Canvas data.

## Migration and implementation impact

Никакая legacy Canvas data migration этим ADR не выполняется: текущий mock не
является production persistence. Следующий persistence-foundation checkpoint
может создавать только accepted workspace-scoped model и обязан добавить
Supabase CLI migration, generated types и RLS/CAS tests. Production schema,
Storage bucket и engine dependency этим ADR не создаются.

## V2 cloud persistence checkpoint

The accepted independent Canvas domain now has a V2 cloud persistence checkpoint.
The V1 document remains the local/client migration input, while cloud rows created
after `20260801120000_canvas_document_v2_persistence.sql` are V2-only. This does not
change the independent workspace-scoped domain, CAS boundary, soft-delete rule,
view-state separation or asset metadata boundary decided by this ADR.

The following cloud repository checkpoint is production-neutral: it injects the
typed authenticated Supabase client, keeps workspace and user boundaries explicit,
and uses `rename_canvas` as the only title mutation path. It does not connect the
repository to the main UI, implement Storage/binary lifecycle, or alter the local
IndexedDB repository contract.

The following asset foundation keeps binary Storage outside `CanvasDocumentV2`.
It extends the metadata foundation with Canvas-scoped identity, a private
`canvas-assets` bucket, RPC-only reserve/finalize/delete lifecycle, and explicit
cleanup errors. Canvas CAS accepts only ready assets belonging to the same
workspace and Canvas; the local Blob repository and main UI remain separate.

## References

- [`ARCHITECTURE.md`](../../ARCHITECTURE.md)
- [`docs/infinite-canvas-v0-architecture.md`](../infinite-canvas-v0-architecture.md)
