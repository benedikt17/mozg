# CHANGELOG

Все существенные изменения проекта документируются в этом файле.

Формат основан на принципах Keep a Changelog.  
Версионирование продукта будет определено перед первым публичным релизом.

## [Unreleased]

### Added

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

- Инструкции для AI-агентов разделяют локальные prototype-задачи и изменения production architecture, Markdown, database и security.
- Prototype model cleanup удалил obsolete milestones и Overview filters.
- Overview manual ordering отделён от Tasks filtering: `overviewOrder` больше не несёт временной семантики.

### Fixed

### Security
