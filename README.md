# Hub

Production foundation на `main` завершён через Stage 1A-4: project/CI foundation, workspace membership и RLS, projects/notes/bootstrap и Markdown pipeline с golden round-trip tests.

Stage 1A-5 ещё не начат. Desktop UX исследуется отдельно в изолированном mock-only Draft PR; актуальное состояние описано в [`docs/PROTOTYPE_STATUS.md`](docs/PROTOTYPE_STATUS.md).

Основные документы:

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — зафиксированная архитектура v1.2;
- [`STAGE-1A-SPEC.md`](STAGE-1A-SPEC.md) — последовательность задач Stage 1A;
- [`AGENTS.md`](AGENTS.md) — правила и scope для AI-агентов;
- [`docs/PROTOTYPE_STATUS.md`](docs/PROTOTYPE_STATUS.md) — статус desktop prototype.

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:markdown
pnpm build
```

Скопируйте `.env.example` в `.env.local` без добавления реальных ключей в Git. `pnpm test:rls` запускается для изменений БД, Auth или RLS при доступном локальном Supabase environment.
