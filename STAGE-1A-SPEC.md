# STAGE-1A-SPEC.md

## Техническое задание: этап 1A — фундамент

Статус архитектуры: **заморожена на `ARCHITECTURE.md v1.2`**; для Canvas
действует более позднее precedence-решение ADR-0004 и контракт
`docs/infinite-canvas-v0-architecture.md`.

Этап 1A создаёт надёжный фундамент приложения до добавления сложной
связки задач с Markdown. Работа разбита на восемь последовательных задач.
Каждая задача выполняется отдельной сессией агента и отдельным PR.

---

## 0. Общие правила этапа

### 0.1 Обязательные документы

Перед началом каждой задачи агент читает:

- `ARCHITECTURE.md`;
- `AGENTS.md`;
- это ТЗ;
- существующие ADR;
- код и тесты, относящиеся к задаче.

### 0.2 Порядок выполнения

Задачи выполняются последовательно:

```text
1A-1
→ 1A-2
→ 1A-3
→ 1A-4
→ 1A-5
→ 1A-6
→ 1A-7
→ 1A-8
```

Параллельное выполнение допускается только после явного выделения
независимых подзадач владельцем проекта.

Критическая зависимость:

```text
1A-4 Markdown pipeline
должен быть завершён до
1A-5 TipTap Editor UI
```

### 0.3 Общий Definition of Done

Для каждого PR:

- задача реализована только в заявленном скоупе;
- нет несвязанных рефакторингов;
- TypeScript strict;
- `any` отсутствует;
- секреты не попали в репозиторий;
- `.env.example` обновлён при появлении новой переменной;
- миграции добавлены через Supabase CLI;
- generated DB types обновлены после миграций;
- применимые тесты зелёные;
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` проходят;
- документация обновлена;
- PR содержит краткий отчёт и список известных ограничений.

---

# 1A-1. Каркас проекта и CI

## Цель

Создать воспроизводимый каркас Next.js-приложения и минимальную
инфраструктуру разработки без продуктовой логики.

## Зависимости

Нет.

## Скоуп

- Next.js App Router;
- TypeScript strict;
- package manager: `pnpm`;
- Tailwind CSS;
- shadcn/ui;
- Supabase CLI;
- базовая структура из §16 `ARCHITECTURE.md`;
- ESLint;
- форматирование;
- test runner;
- CI;
- env schema;
- пустой PWA-каркас без offline-логики.

## Обязательная структура

```text
src/
  app/
    (app)/
      inbox/
      today/
      search/
      archive/
      p/
        [projectId]/
          notes/
          tasks/
      canvas/                 # будущий top-level Canvas domain; не входит в 1A
    share/
      [token]/
    api/
      transcribe/
      share/
      export/

  components/
    ui/
    editor/
    canvas/
    tasks/
    inbox/

  lib/
    supabase/
    markdown/
    transcription/
    offline-queue/
    export/
    i18n.ts

  stores/

supabase/
  migrations/

tests/
  markdown-roundtrip/
  rls/
  task-sync/
  export/

docs/
  adr/
```

Пустые директории сохраняются через `.gitkeep` или README там, где это
необходимо.

## Требования

1. Инициализировать Next.js на текущем stable major и закрепить версии в lockfile.
2. Включить строгую проверку TypeScript.
3. Настроить aliases, включая `@/*`.
4. Подключить Tailwind и базовую конфигурацию shadcn/ui.
5. Добавить только минимальные shadcn-компоненты, необходимые для smoke UI.
6. Инициализировать локальную структуру Supabase.
7. Добавить `.env.example` без реальных секретов.
8. Создать серверный и браузерный Supabase clients в разных модулях.
9. Не добавлять service-role клиент в client bundle.
10. Настроить test runner для TypeScript unit tests.
11. Добавить CI workflow.

## Обязательные scripts

Названия могут быть адаптированы, но должны существовать эквиваленты:

```json
{
  "lint": "...",
  "typecheck": "...",
  "test": "...",
  "test:markdown": "...",
  "test:rls": "...",
  "build": "..."
}
```

На этом шаге `test:markdown` и `test:rls` могут запускать пустые smoke
suites, но не должны быть фиктивными командами, всегда возвращающими
успех без запуска test runner.

## CI

На pull request CI выполняет:

1. install с frozen lockfile;
2. lint;
3. typecheck;
4. unit tests;
5. build.

RLS integration tests можно подключить после 1A-2, если для них требуется
локальный Supabase.

## Не входит в задачу

- Auth UI;
- таблицы продукта;
- RLS-политики;
- TipTap;
- редактор;
- FTS;
- Inbox;
- настоящая PWA offline queue.

## Definition of Done

- локальный запуск работает;
- production build проходит;
- CI зелёный;
- структура соответствует архитектуре;
- `.env.example` присутствует;
- отсутствуют реальные ключи;
- создан минимальный smoke route;
- в PR нет продуктовой логики.

---

# 1A-2. Workspaces, members и RLS foundation

## Цель

Создать базовый multi-tenant security foundation и доказать его
интеграционными тестами.

## Зависимости

- 1A-1.

## Скоуп

- миграция `workspaces`;
- миграция `workspace_members`;
- enum-like role constraint;
- helper-функции RLS;
- базовые политики;
- защита последнего owner;
- RLS test harness;
- generated DB types.

## Требования к схеме

Реализовать таблицы из §4.2 `ARCHITECTURE.md`.

`workspaces.owner_id` не создавать.

Источник истины владельца:

```text
workspace_members.role = 'owner'
```

## RLS helper-функции

Создать и протестировать:

```sql
is_workspace_member(workspace_id uuid)
has_workspace_role(workspace_id uuid, roles text[])
```

Требования:

- `SECURITY DEFINER`;
- фиксированный безопасный `search_path`;
- минимальные grants;
- отсутствие динамического SQL;
- отсутствие рекурсивного обращения к политикам;
- функции не должны позволять подменить workspace.

## Инварианты

Проверить политиками, функциями или триггерами:

- anonymous не читает workspace;
- пользователь видит workspace только при membership;
- viewer не изменяет данные;
- editor не меняет роли;
- editor не повышает себя до owner;
- последний owner не удаляется;
- последний owner не понижается;
- участник не может присоединить себя к чужому workspace;
- пользователь не может перенести membership между workspace.

## RLS tests

Тесты должны работать минимум с четырьмя контекстами:

- anonymous;
- owner;
- editor;
- viewer;
- outsider.

Проверяются и разрешённые, и запрещённые действия.

Запрещённая операция должна действительно завершаться отказом, а не
возвращать пустой результат, если тестируется write operation.

## Не входит в задачу

- автоматическое создание workspace после signup;
- projects;
- notes;
- продуктовый UI;
- приглашения участников.

## Definition of Done

- миграции применяются на чистой локальной БД;
- rollback обеспечивается пересозданием local DB из миграций;
- helper-функции покрыты тестами;
- все RLS scenarios зелёные;
- generated types обновлены;
- `pnpm test:rls` запускает реальные integration tests;
- архитектурные инварианты не реализованы только на клиенте.

---

# 1A-3. Projects, notes и bootstrap пользователя

## Цель

Добавить проектную и заметочную модель с жёсткими границами workspace,
индексами и автоматическим bootstrap нового пользователя.

## Зависимости

- 1A-2.

## Скоуп

- `projects`;
- `notes`;
- составные FK;
- индексы;
- `updated_at` trigger;
- signup bootstrap;
- базовые CRUD policies;
- RLS tests;
- generated types.

## Требования к projects

Реализовать §4.3 `ARCHITECTURE.md`, включая:

```sql
unique (workspace_id, id)
```

Пользовательское удаление физически не выполняется.

## Требования к notes

Реализовать §4.4, включая:

- `content_md`;
- `version`;
- `archived_at`;
- `share_token`;
- `is_daily`;
- `daily_date`;
- generated `search_tsv`;
- `russian + simple`;
- составной FK на project;
- check consistency для daily note;
- GIN index;
- unique active title;
- unique daily note per date.

## Bootstrap при регистрации

После создания строки в `auth.users` система должна атомарно создать:

1. workspace;
2. membership с ролью `owner`.

Требования:

- повторный вызов не создаёт дубликаты;
- ошибка не оставляет частично созданный bootstrap;
- функция не принимает owner ID из недоверенного клиента;
- имя workspace может использовать безопасное значение по умолчанию.

## RLS

Добавить и протестировать:

- owner/editor создают и редактируют projects/notes;
- viewer только читает;
- outsider не читает;
- child нельзя связать с parent другого workspace;
- `workspace_id` существующей записи нельзя изменить;
- составной FK отклоняет cross-workspace relation независимо от RLS;
- архивная запись остаётся доступной владельцу через специальный запрос, но не входит в обычный active query.

## Не входит в задачу

- Editor UI;
- снапшоты;
- wiki-links UI;
- задачи;
- публичный шаринг;
- полноценный поиск UI.

## Definition of Done

- схема полностью создаётся из миграций;
- signup bootstrap протестирован;
- cross-workspace foreign keys протестированы;
- индексы существуют;
- RLS tests зелёные;
- generated types обновлены;
- нет client-side обходов security model.

---

# 1A-4. Markdown pipeline и golden tests

## Цель

Доказать надёжность Markdown parser/serializer до создания редакторского UI.

## Зависимости

- 1A-1;
- логически после 1A-3, но задача не должна зависеть от UI или живой БД.

## Главный принцип

```text
Markdown — источник правды.
```

Editor JSON, AST и любые внутренние структуры являются производными.

## Скоуп

- Markdown parser;
- Markdown serializer;
- task marker parser;
- wiki-link parser;
- headless TipTap document conversion при необходимости;
- golden fixtures;
- canonicalization rules;
- round-trip tests;
- unit tests для task/wiki extraction.

## Обязательный публичный API

Точные имена могут отличаться, но должны существовать типизированные
эквиваленты:

```ts
parseMarkdown(markdown: string): MarkdownDocument
serializeMarkdown(document: MarkdownDocument): string

extractTaskReferences(markdown: string): ParsedTaskReference[]
extractWikiLinks(markdown: string): ParsedWikiLink[]
```

`ParsedTaskReference` должен включать минимум:

```ts
type ParsedTaskReference = {
  id: string
  title: string
  checkedMarker: boolean
  lineOrPosition: number
}
```

## Канонический task-синтаксис

```md
- [ ] Текст задачи ^task-550e8400-e29b-41d4-a716-446655440000
- [x] Выполненная задача ^task-a8098c1a-f86e-11da-bd1a-00112444be1e
```

Парсер обязан:

- валидировать UUID;
- не создавать ID сам;
- различать обычный checkbox и task с ID;
- не принимать два разных task ID в одной строке;
- определённо обрабатывать duplicate task ID;
- не менять `content_md` скрыто.

## Канонический wiki-синтаксис

```md
[[Название заметки]]
```

На этом шаге реализуются parsing и serialization, но не navigation UI.

## Golden fixtures

Минимальный набор:

1. обычные заголовки и абзацы;
2. русская кириллица;
3. inline formatting;
4. ссылки;
5. изображения;
6. fenced code blocks;
7. inline code;
8. ordered/unordered nested lists;
9. task lists;
10. task ID;
11. wiki-links;
12. wiki-link рядом со спецсимволами;
13. смешанный русский и английский текст;
14. HTML или неизвестная конструкция, если она допускается выбранным pipeline;
15. CRLF input;
16. trailing newline;
17. пустой документ;
18. malformed task marker;
19. duplicate task ID;
20. повторный round-trip.

## Правило сравнения

Для каждого fixture заранее фиксируется одно из двух правил:

- byte-stable round-trip;
- canonicalized round-trip.

Canonicalization должна быть явно документирована. Нельзя скрывать
потерю данных под общим `trim()`.

Проверка устойчивости:

```text
md₀ → document₁ → md₁ → document₂ → md₂
```

Требование:

```text
md₁ = md₂
```

после разрешённой canonicalization.

## Не входит в задачу

- React Editor UI;
- autosave;
- сохранение в Supabase;
- task upsert;
- wiki navigation;
- command palette.

## Definition of Done

- golden suite реально падает при потере task ID;
- golden suite реально падает при потере wiki-link;
- неизвестные разрешённые конструкции не исчезают молча;
- parser/serializer API типизирован;
- headless tests не требуют браузерного UI;
- `pnpm test:markdown` зелёный;
- 1A-5 нельзя начинать до merge этой задачи.

---

# 1A-5. TipTap Editor и wiki-links

## Цель

Создать минимальный рабочий редактор поверх уже проверенного
Markdown pipeline.

## Зависимости

- 1A-3;
- 1A-4 обязательно завершена и merged.

## Скоуп

- TipTap Editor UI;
- загрузка Markdown;
- преобразование Markdown ↔ editor state;
- базовое форматирование;
- task-node с клиентским ID;
- wiki-link extension;
- создание заметки по несуществующей wiki-link;
- минимальный read mode;
- editor tests.

## Требования

1. Editor загружает `content_md`, а не сохранённый proprietary JSON.
2. Editor JSON не записывается в БД как источник правды.
3. Новый task-node сразу получает:

```ts
crypto.randomUUID()
```

4. Serializer сохраняет `^task-uuid`.
5. Сервер не вызывается для генерации task ID.
6. Wiki-link отображается как отдельный интерактивный node/mark.
7. Resolution выполняется только в текущем project.
8. Resolution игнорирует архивные notes.
9. Если note существует, клик открывает её.
10. Если note не существует, клик создаёт note с таким title.
11. Race при одновременном создании одинаковой note обрабатывается через unique constraint: после конфликта открывается существующая note.
12. UI не разрешает создать второй активный duplicate title.

## Минимальное форматирование

- headings;
- paragraph;
- bold;
- italic;
- links;
- code;
- code block;
- bullet/ordered lists;
- task list;
- image syntax, если поддержана в 1A-4.

## Не входит в задачу

- task table synchronization;
- autosave production quality;
- snapshots;
- FTS UI;
- attachments upload;
- slash commands;
- AI generation;
- collaborative editing.

## Definition of Done

- существующая note открывается и редактируется;
- сохранённый Markdown проходит pipeline из 1A-4;
- task ID переживает открыть → изменить → сохранить;
- wiki-link переживает round-trip;
- duplicate note title не создаётся;
- editor tests зелёные;
- `pnpm test:markdown` остаётся зелёным.

---

# 1A-6. Сохранение, optimistic concurrency и snapshots

## Цель

Сделать безопасное серверное сохранение заметки с защитой от двух вкладок
и ограниченным версионированием.

## Зависимости

- 1A-3;
- 1A-4;
- 1A-5.

## Скоуп

- server save contract;
- optimistic concurrency;
- `note_snapshots`;
- snapshot throttling;
- restore;
- conflict response;
- client conflict UI;
- tests.

## Server save contract

Запрос содержит минимум:

```ts
type SaveNoteInput = {
  noteId: string
  expectedVersion: number
  title: string
  contentMd: string
}
```

Сервер:

1. проверяет membership и role;
2. валидирует вход;
3. обновляет note только при совпадении `version`;
4. увеличивает `version`;
5. создаёт snapshot при выполнении правил;
6. возвращает новую версию;
7. не переписывает Markdown скрыто.

На этапе 1A task upsert ещё не реализуется. Task IDs должны сохраняться
в Markdown, но таблица `tasks` добавляется в 1B.

## Конфликт

При несовпадении версии:

- сервер возвращает `409`;
- ответ содержит безопасные данные, необходимые для merge UI;
- клиент не выполняет silent overwrite;
- пользователь может:
  - открыть актуальную серверную версию;
  - скопировать локальную версию;
  - выбрать явную перезапись, если такая операция отдельно защищена.

## Snapshots

Реализовать §4.5 и §5 `ARCHITECTURE.md`.

Правила:

- interval snapshot — не чаще одного раза в 10 минут;
- snapshot создаётся только при изменившемся hash;
- `manual`, `restore`, `pre_agent` обходят interval;
- хранится 10 последних snapshot на note;
- перед restore создаётся snapshot текущей версии;
- pruning выполняется транзакционно или безопасной серверной процедурой.

## Тесты

- обычное сохранение;
- version increment;
- конфликт двух вкладок;
- повтор того же save;
- snapshot не чаще 10 минут;
- snapshot при изменившемся hash;
- отсутствие snapshot при том же hash;
- manual snapshot;
- restore;
- pre-restore snapshot;
- pruning до 10;
- outsider/editor/viewer access.

## Не входит в задачу

- tasks synchronization;
- full diff UI;
- offline editing;
- realtime;
- AI editing.

## Definition of Done

- silent overwrite невозможен;
- два параллельных save не проходят оба с одной версией;
- snapshots ограничены;
- restore протестирован;
- RLS не обходится server handler;
- UI сообщает о конфликте;
- тесты зелёные.

---

# 1A-7. Full Text Search и Cmd+K

## Цель

Добавить быстрый поиск по активным заметкам текущего workspace и project.

## Зависимости

- 1A-3;
- 1A-5.

## Скоуп

- SQL search function/query;
- ranking;
- snippets;
- filters;
- Command Palette;
- keyboard shortcuts;
- tests.

## Требования поиска

Использовать существующий `search_tsv`:

```text
russian + simple
```

Поиск по умолчанию:

- только workspace текущего пользователя;
- только активные notes;
- все projects workspace;
- с возможностью ограничить текущим project;
- без service-role;
- с RLS.

Результат содержит минимум:

```ts
type NoteSearchResult = {
  noteId: string
  projectId: string
  projectName: string
  title: string
  snippet: string
  rank: number
  updatedAt: string
}
```

## UX

- `Cmd+K` на macOS;
- `Ctrl+K` на Windows/Linux;
- поле получает focus;
- debounce;
- loading state;
- empty state;
- keyboard navigation;
- Enter открывает note;
- Escape закрывает palette;
- запрос не должен создавать N+1.

## Безопасность

- query параметризован;
- пользователь не может искать чужой workspace;
- архивные notes исключены;
- snippet безопасно отображается без произвольного HTML.

## Тесты

- русский запрос;
- английский/латинский запрос;
- технический identifier;
- смешанный запрос;
- ranking title выше body;
- archive excluded;
- outsider excluded;
- keyboard navigation;
- empty query;
- special characters.

## Не входит в задачу

- semantic search;
- embeddings;
- fuzzy graph;
- поиск по canvas;
- поиск по attachments content;
- поиск по tasks.

## Definition of Done

- Cmd/Ctrl+K работает;
- поиск использует GIN-backed FTS;
- результаты ограничены RLS;
- русский и латиница покрыты тестами;
- нет N+1;
- архив исключён.

---

# 1A-8. Архив, ручной экспорт и PWA-каркас

## Цель

Завершить фундамент безопасным удалением, переносимым экспортом и
минимальным устанавливаемым PWA shell.

## Зависимости

- 1A-3;
- 1A-5;
- 1A-6;
- 1A-7.

## Скоуп

- архивация projects/notes;
- archive UI;
- restore;
- ручной export endpoint;
- export manifest;
- Serwist PWA shell;
- installability;
- cache isolation;
- tests.

## Архив

Реализовать:

- archive action;
- restore action;
- active lists exclude archived;
- search excludes archived;
- wiki resolution excludes archived;
- archive section;
- archived share resource считается недоступным;
- физическое удаление отсутствует в обычном UI.

Архивация project не обязана массово менять `archived_at` каждого child,
но active queries и UI должны последовательно скрывать его содержимое.
Выбранная семантика фиксируется тестами и документацией.

## Ручной экспорт

Endpoint доступен только owner.

Минимальный экспорт:

```text
export/
  manifest.json
  workspace.json
  projects/
    <project-id>/
      project.json
      notes/
  inbox/
  attachments-manifest.json
```

На этапе 1A экспорт может не скачивать binary Storage files, если
attachments UI ещё не существует, но обязан:

- иметь versioned manifest;
- перечислять известные attachments;
- экспортировать Markdown без потерь;
- экспортировать archived state;
- не включать секреты;
- иметь стабильные filenames;
- корректно экранировать unsafe filenames;
- работать потоково или с установленным безопасным лимитом.

Если таблицы tasks/inbox ещё не реализованы, manifest явно указывает отсутствие
соответствующих секций, а не имитирует их наличие. Canvas export не является
частью 1A: будущий Canvas domain живёт отдельно от project subtree и следует
`CanvasDocumentV1`/`canvas_assets` контракту из ADR-0004.

## PWA-каркас

Serwist:

- app manifest;
- icons/placeholders;
- app shell cache;
- offline fallback page;
- отсутствие полного offline editing;
- отсутствие Inbox queue до этапа 2;
- cache versioning;
- очистка user-scoped persisted data при logout.

Service Worker не должен кэшировать:

- private API responses без стратегии;
- share pages вопреки `no-store`;
- auth tokens;
- server-rendered private HTML как общедоступный cache.

## Тесты

- archive note;
- restore note;
- archive excluded from search;
- archive excluded from wiki resolution;
- export owner allowed;
- editor/viewer/outsider export denied;
- export manifest validates;
- Markdown export exact/canonical;
- PWA manifest reachable;
- service worker registration;
- private routes not accidentally cached.

## Не входит в задачу

- offline Inbox queue;
- Background Sync;
- Web Share Target;
- audio;
- OpenAI;
- tldraw;
- public sharing UI;
- automatic backups.

## Definition of Done

- пользователь может архивировать и восстановить note/project;
- физическое удаление отсутствует;
- owner получает валидный экспорт;
- экспорт не содержит секретов;
- PWA устанавливается;
- offline fallback существует;
- приложение не обещает offline editing;
- все gates зелёные.

---

# 2. Приёмка этапа 1A

Этап 1A считается завершённым только после merge всех восьми задач.

## Функциональная приёмка

Владелец может:

1. зарегистрироваться;
2. автоматически получить workspace;
3. создать project;
4. создать note;
5. редактировать Markdown через TipTap;
6. использовать wiki-links;
7. открыть приложение в двух вкладках и увидеть конфликт вместо потери данных;
8. восстановить snapshot;
9. найти note через Cmd/Ctrl+K;
10. архивировать и восстановить note;
11. выгрузить ручной экспорт;
12. установить PWA shell.

## Техническая приёмка

- чистая локальная БД поднимается только из миграций;
- RLS tests зелёные;
- Markdown golden tests зелёные;
- build зелёный;
- нет committed secrets;
- нет `any`;
- нет cross-workspace relation;
- нет silent overwrite;
- ARCHITECTURE.md не изменён без ADR;
- known limitations зафиксированы.

## Вне приёмки 1A

- таблица tasks и task sync;
- Inbox;
- голос;
- транскрипция;
- attachments upload UI;
- tldraw;
- public sharing;
- automatic backup;
- full offline mode.
