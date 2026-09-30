# AGENTS.md

Этот репозиторий разрабатывается с участием AI-агентов.  
`ARCHITECTURE.md` — обязательный и приоритетный источник архитектурных решений.

## 1. Перед задачей

Сначала агент определяет категорию и границы задачи, затем читает необходимый контекст:

| Тип задачи | Обязательный контекст перед началом |
| --- | --- |
| Узкое изменение UI, текста, CSS или изолированного компонента прототипа | Задача, `src/prototype/AGENTS.override.md`, непосредственно связанные prototype-компоненты, стили и тесты |
| Prototype state, reducer, selector или interaction | Задача, `src/prototype/AGENTS.override.md`, непосредственно связанные state/model-файлы, компоненты и тесты |
| Markdown parser, serializer, references или editor contract | Релевантные разделы `ARCHITECTURE.md`, Markdown-документация, parser, serializer, references, fixtures и round-trip tests |
| БД, Auth, RLS, Storage, migration или persistence | Релевантные разделы архитектуры, существующие migrations, generated types, RLS/integration tests и связанные server/client boundaries |
| Архитектурное или cross-domain изменение | Полный релевантный архитектурный контекст, ADR evaluation, все затрагиваемые модули и тесты |

Для prototype state/interaction задачи более широкий архитектурный контекст читается только при пересечении с production behavior или замороженным решением. Узкая prototype-задача не требует чтения полного `ARCHITECTURE.md`, migrations, RLS tests, Markdown pipeline или несвязанных разделов прототипа.

Агент не начинает реализацию, пока не определены границы задачи и Definition of Done. Не проводить repository-wide аудит и не исследовать несвязанные domains по умолчанию. Несвязанные находки сообщать без исправления; предпочитать наименьшее безопасное изменение.

## 2. Неприкосновенные решения

Раздел 18 `ARCHITECTURE.md` нельзя пересматривать, обходить или менять молча.

В частности:

- Markdown — источник правды заметок;
- TipTap JSON — временное представление редактора;
- задача — строка в `tasks`;
- task ID генерируется на клиенте;
- сервер не дописывает task ID обратно в Markdown;
- `[ ]` / `[x]` — производный кэш;
- границы workspace защищаются составными FK, RLS и кодом;
- пользовательское удаление означает архивацию;
- изменения Markdown-пайплайна проходят golden round-trip tests;
- полный offline-sync заметок не реализуется;
- tldraw не заменяется собственным canvas;
- внешние провайдеры подключаются через адаптеры.

Если задача требует изменить одно из этих решений, агент обязан:

1. остановить реализацию;
2. подготовить отдельный ADR;
3. описать причину, альтернативы, последствия и миграционный путь;
4. не вносить изменение до принятия ADR владельцем проекта.

## 3. Единица работы

Одна задача этапа = одна ветка = один PR.

PR не должен содержать:

- несвязанный рефакторинг;
- обновление major-версий зависимостей;
- замену библиотек без ADR;
- изменение архитектурных решений;
- исправления, не относящиеся к текущему Definition of Done.

Допустимы только минимальные сопутствующие изменения, без которых задача не может быть завершена.

### 3.1 Production baseline и происхождение релиза

- Принятый контрольный пункт `baseline/production-2026-09-01-c123579`
  указывает на Production commit `c12357969498ec3b24fe2e3733095a47c255576e`
  и никогда не перемещается и не удаляется.
- Новая задача начинается только после `git fetch origin
  refactor/prototype-state-root`; отдельная ветка и worktree создаются от
  актуального `origin/refactor/prototype-state-root`, а не от ранее открытой
  feature-ветки, локального HEAD или исторического baseline.
- Любой feature-кандидат обязан содержать текущий Production HEAD в своей
  истории. Несовпадение означает `STOP / NO-GO`: сначала перенос изменений на
  актуальную основу, затем повтор всех применимых проверок.
- Обычный Production-релиз выполняется только fast-forward обновлением ветки
  `refactor/prototype-state-root` после принятого Preview. Force-push, silent
  merge commit, прямой `vercel --prod` и продвижение Preview через `vercel
  promote` запрещены. Rollback допускается только как отдельно подтверждённое
  аварийное действие с точным deployment ID.
- Vercel Production deployment обязан содержать Git provenance:
  `githubCommitRef = refactor/prototype-state-root` и точный
  `githubCommitSha`. Deployment без этих полей не считается допустимым
  Production-релизом.
- Перед завершением релиза повторно сверяются Production branch SHA, Vercel
  deployment SHA, статус `READY`, Production smoke и runtime errors.
- Git baseline защищает код, но не данные. Изменения БД требуют отдельного
  backup/restore checkpoint и database gates из разделов 4–5.

## 4. Миграции и база данных

- Схема БД меняется только через Supabase CLI.
- Все изменения фиксируются в `supabase/migrations/*.sql`.
- Ручные изменения production-схемы через Dashboard запрещены.
- Существующие миграции после merge не переписываются.
- Для изменения схемы создаётся новая миграция.
- После изменения схемы обновляются generated DB types.
- Связи внутри workspace используют составные FK.
- RLS включается и тестируется для каждой пользовательской таблицы.
- Service-role ключ никогда не передаётся клиенту.

## 5. Матрица проверок

Во время итерации используются самые узкие применимые проверки. Перед завершением выполняются gates по категории задачи:

| Изменение | Во время итерации | Перед завершением |
| --- | --- | --- |
| Prototype text, CSS или изолированный component | Targeted inspection и relevant tests; `pnpm typecheck`, если менялся TypeScript | `pnpm lint`, `pnpm typecheck`, `pnpm build`, relevant tests |
| Prototype reducer, selector, task model или interaction | Связанные Vitest-файлы и `pnpm typecheck` | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `git diff --check` |
| Markdown pipeline или contract | Связанные golden/round-trip tests и `pnpm typecheck` | `pnpm test:markdown`, полный `pnpm test`, `pnpm typecheck`, `pnpm build` |
| БД, Auth, RLS, Storage или migration | Связанные migrations, generated types и targeted integration checks | Все применимые database gates, generated types verification, `pnpm test:rls` и общие gates |
| Архитектурное или cross-domain изменение | Проверки всех затронутых слоёв | ADR evaluation и все применимые gates |

Для prototype-only задачи без изменений database-related файлов Supabase/RLS gates не запускаются.

Падение gate нельзя обходить отключением теста, ослаблением assertion или добавлением исключения без явного обоснования в PR.

## 6. Код

- TypeScript strict.
- `any` запрещён.
- Новая бизнес-логика покрывается тестами.
- Критическая логика не дублируется на клиенте и сервере.
- Секреты читаются только из env.
- Значения env документируются в `.env.example` без реальных ключей.
- Ошибки внешних сервисов не должны раскрывать секреты или внутренние payload.
- Изменение `workspace_id` существующей записи запрещено.
- Временные заглушки помечаются `TODO` с номером задачи.

## 7. Markdown и редактор

Любое изменение parser, serializer, TipTap extensions, task-node или wiki-links обязано:

1. добавить или обновить golden fixtures;
2. пройти `tests/markdown-roundtrip`;
3. не терять неизвестную поддерживаемую разметку;
4. сохранять `^task-uuid`;
5. сохранять `[[wiki-links]]`;
6. не превращать Editor JSON в источник правды.

## 8. Работа с файлами

Агент не должен удалять, переименовывать или массово форматировать файлы вне своей задачи.

Запрещено:

- удалять пользовательские данные;
- выполнять destructive migration без отдельного плана;
- коммитить `.env`;
- коммитить service-role или OpenAI API key;
- коммитить дампы production-данных;
- добавлять бинарные артефакты сборки.

## 9. Завершение задачи

В итоговом сообщении и PR должны быть указаны:

1. что реализовано;
2. какие файлы изменены;
3. какие миграции добавлены;
4. какие тесты добавлены или обновлены;
5. какие команды проверки выполнены;
6. известные ограничения;
7. соответствие Definition of Done;
8. требуется ли ADR или миграция данных.

Если Definition of Done выполнен не полностью, задача не помечается завершённой.
