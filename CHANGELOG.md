# CHANGELOG

Все существенные изменения проекта документируются в этом файле.

Формат основан на принципах Keep a Changelog.  
Версионирование продукта будет определено перед первым публичным релизом.

## [Unreleased]

### Added

- Project Files Stage A1 foundation: Project-scoped folders/files/variants metadata, private `project-files` Storage, explicit 50 MiB upload policy, Snapshot V3 Project validation, RLS/Storage policies, reserve → upload → finalize lifecycle, soft-delete/restore, generated DB types and a typed Supabase repository boundary.
- Canvas navigation groups: nested persistent local/cloud groups, Canvas membership moves, archive promotion, and RLS coverage.

- `ARCHITECTURE.md v1.2` как замороженный архитектурный baseline.
- `AGENTS.md` с правилами работы AI-агентов.
- `STAGE-1A-SPEC.md` с последовательностью задач этапа 1A.
- Каталог `docs/adr/` для архитектурных решений.
- Stage 1A-1: Next.js foundation, strict TypeScript, pnpm, Tailwind/shadcn, Supabase CLI и CI gates.
- Stage 1A-2: workspaces, memberships, roles, RLS helpers, policies и integration tests.
- Stage 1A-3: projects, notes, indexes, signup bootstrap, RLS и generated database types.
- Stage 1A-4: typed Markdown parser/serializer, task/wiki extraction и golden round-trip tests.
- Изолированное mock-only исследование desktop UX на route `/prototype/desktop` в Draft PR #6.

### Changed

- Files mutations are explicitly qualified by `workspace_id + project_id + resource_id`; Product Project identity follows Desktop Snapshot V3 text IDs rather than the legacy UUID `public.projects` table.
- Project Files keeps a 50 MiB server/bucket ceiling while the current standard browser upload path is capped at 6 MiB; larger accepted files require the later TUS/resumable path.
- Инструкции для AI-агентов разделяют локальные prototype-задачи и изменения production architecture, Markdown, database и security.
- Prototype model cleanup удалил obsolete milestones и Overview filters.
- Overview manual ordering отделён от Tasks filtering: `overviewOrder` больше не несёт временной семантики.

### Fixed

### Security

- Project Files originals cannot be overwritten or physically deleted by normal clients; Storage access is resolved from authoritative metadata plus workspace membership/role, not from caller-composed paths.
