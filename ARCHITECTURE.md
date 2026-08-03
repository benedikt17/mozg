# ARCHITECTURE.md — v1.2

Персональный рабочий инструмент для проектов, Markdown-заметок, задач,
бесконечных холстов и быстрого инбокса с голосовым вводом.

Первая версия рассчитана на одного пользователя, но модель данных,
авторизация и разграничение доступа изначально строятся через `workspace`,
чтобы в будущем можно было добавить совместную работу без полной
перестройки архитектуры.

---

## 0. Зафиксированные допущения

| # | Допущение | Значение |
|---|-----------|----------|
| 1 | Кодовое имя | `hub`. Используется только как внутреннее имя проекта и не считается публичным брендом |
| 2 | Язык интерфейса | Русский. Полноценный i18n-фреймворк не используется, но пользовательские строки и форматирование дат централизуются в `lib/i18n.ts` |
| 3 | Фактическое место работы | Пользователь физически находится в России и обычно работает через стабильный европейский VPN |
| 4 | Регион Supabase | Стартовый кандидат — `Central EU (Frankfurt)`. Окончательный выбор делается до создания production-проекта по измеренной задержке полного маршрута: клиент → VPN → приложение → Supabase |
| 5 | Доступность внешних сервисов | Доступность Supabase, Vercel, OpenAI и других зарубежных сервисов из России не считается гарантированной. VPN является частью текущей эксплуатационной схемы, но не архитектурной гарантией |
| 6 | Транскрипция | Используется внутренний интерфейс провайдера транскрипции. Первая реализация — OpenAI Audio Transcriptions API; модель задаётся через env и может быть заменена без миграции данных |
| 7 | Лимиты вложений | Разделяются по типам. Клиентская проверка используется для UX, серверная проверка обязательна |

---

## 1. Архитектурный стиль

Приложение строится как **workspace-first модульный монолит**:

- клиентский интерфейс и серверная бизнес-логика находятся в одном Next.js-приложении;
- PostgreSQL, Auth и файловое хранилище предоставляет Supabase;
- данные разделяются по `workspace_id`;
- multi-tenant граница обеспечивается одновременно схемой БД, RLS и кодом;
- приложение работает по модели online-first;
- офлайн-режим поддерживается только для быстрого Inbox;
- заметки хранятся в переносимом Markdown;
- production Canvas следует независимому persistence-domain контракту; engine
  выбирается только после disposable spike, а текущий mock не является production;
- внешние сервисы подключаются через заменяемые адаптеры.

---

## 2. Стек

| Слой | Технология | Комментарий |
|------|------------|-------------|
| Framework | Next.js — current stable major, закреплённый в `package.json`; App Router; TypeScript strict | Смена major-версии — только отдельным ADR |
| UI | Tailwind CSS + shadcn/ui | Другие UI-киты не добавлять |
| Редактор | TipTap | Источник правды — чистый Markdown |
| Холст | `CanvasDocumentV2` для cloud persistence, V1 → V2 migration на local/client boundary и library-independent adapter | Engine не выбран; React Flow и tldraw оцениваются только в disposable spike |
| Server state | TanStack Query | Запросы, кэш, мутации |
| UI state | Zustand | Только локальное состояние интерфейса |
| БД / Auth / Storage | Supabase: PostgreSQL, RLS, Auth, Storage | |
| Миграции | Supabase CLI | Только `supabase/migrations/*.sql`; схему вручную в Dashboard не менять |
| PWA | Serwist + Service Worker + IndexedDB (`idb`) | Fallback — ручной Service Worker по официальной схеме Next.js |
| Поиск | PostgreSQL Full Text Search | Конфигурации `russian` + `simple`, GIN-индексы |
| Хостинг приложения | Vercel | Регион исполнения должен быть согласован с регионом Supabase |
| Транскрипция | Адаптер `TranscriptionProvider` | Первая реализация — OpenAI Audio Transcriptions API |
| Бэкапы | GitHub Actions cron + приватное внешнее хранилище | База и Storage резервируются отдельно |

---

## 3. Основные архитектурные принципы

1. Всё пользовательское содержимое принадлежит `workspace`.
2. Граница workspace защищается тремя слоями:
   - составными foreign key;
   - RLS;
   - серверной бизнес-логикой.
3. Markdown является источником правды для заметок.
4. Задача является строкой в таблице `tasks`.
5. Чекбокс внутри Markdown — представление задачи, а не самостоятельная запись.
6. Удаление пользовательских данных по умолчанию означает архивацию.
7. Полный offline-sync заметок не реализуется.
8. Canvas persistence не зависит от engine-specific store; engine выбирается
   только после disposable spike. CRDT и realtime-коллаборация не реализуются.
9. Любое изменение Markdown-пайплайна проходит golden round-trip tests.
10. Внешние провайдеры не должны проникать напрямую в доменную логику.

---

### Local development access invariant

`MOZG_LOCAL_DEV_MODE`, read by `src/lib/local-development-mode.ts`, is the
explicit entry point for local direct access. When it is enabled, the local
Desktop opens without interactive Auth UI. The server-only
`src/app/auth/local-development/route.ts` prepares an ordinary local Supabase
user session before the cloud Desktop flow runs.

Both `http://127.0.0.1:3000` and `http://localhost:3000` are supported local
browser origins. Bootstrap returns to the incoming origin, so each
host-scoped session cookie remains available to the following Desktop request;
the development server explicitly allows `127.0.0.1` for its client resources.

Local direct access does not mean local persistence. The main Desktop continues
to use the cloud Canvas repository, cloud asset repository, the actual
development workspace, local Supabase PostgreSQL/Storage, and RLS. The
service-role credential is allowed only inside that server-only local bootstrap
boundary and never reaches the browser or application repositories. Production
keeps the normal Auth guard because local mode is disabled there.

The isolated local Canvas route remains a separate regression route. The main
Desktop must never silently fall back to IndexedDB, a local Blob repository, or
an isolated workspace.

---

## 4. Модель данных

### 4.1 Общие правила

Для всех основных таблиц:

```sql
id uuid primary key default gen_random_uuid(),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

`updated_at` обновляется единым триггером.

Все даты хранятся в UTC. Отображение выполняется в таймзоне клиента.

Типы БД генерируются через:

```bash
supabase gen types
```

Использование `any` запрещено.

---

### 4.2 Workspaces и участники

```sql
workspaces (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
)

workspace_members (
  workspace_id uuid not null references workspaces(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (workspace_id, user_id)
)
```

Поля `owner_id` в `workspaces` нет.

Единственный источник истины о владельцах:

```text
workspace_members.role = 'owner'
```

При регистрации пользователя серверный триггер создаёт:

1. workspace;
2. membership с ролью `owner`.

Последний владелец workspace не может быть удалён или понижен в роли.

---

### 4.3 Projects

```sql
projects (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  name text not null,
  emoji text,
  color text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (workspace_id, id)
)
```

`unique (workspace_id, id)` используется как опора для составных FK дочерних таблиц.

---

### 4.4 Notes

```sql
notes (
  id uuid primary key,
  workspace_id uuid not null,
  project_id uuid not null,
  title text not null,
  content_md text not null default '',
  is_daily boolean not null default false,
  daily_date date,
  version bigint not null default 1,
  archived_at timestamptz,
  share_token uuid,
  search_tsv tsvector generated always as (
    setweight(
      to_tsvector('russian', coalesce(title, '')),
      'A'
    )
    ||
    setweight(
      to_tsvector('russian', coalesce(content_md, '')),
      'B'
    )
    ||
    setweight(
      to_tsvector('simple', coalesce(title, '')),
      'A'
    )
    ||
    setweight(
      to_tsvector('simple', coalesce(content_md, '')),
      'B'
    )
  ) stored,
  created_at timestamptz not null,
  updated_at timestamptz not null,

  unique (workspace_id, id),

  foreign key (workspace_id, project_id)
    references projects (workspace_id, id),

  check (
    (is_daily = true and daily_date is not null)
    or
    (is_daily = false and daily_date is null)
  )
)
```

Уникальность активных названий внутри проекта:

```sql
create unique index notes_project_title_unique
on notes (
  project_id,
  lower(btrim(title))
)
where archived_at is null;
```

Одна daily note на дату внутри проекта:

```sql
create unique index notes_daily_unique
on notes (
  project_id,
  daily_date
)
where is_daily = true
  and archived_at is null;
```

Поиск:

```sql
create index notes_search_tsv_gin
on notes using gin(search_tsv);
```

---

### 4.5 Note snapshots

```sql
note_snapshots (
  id uuid primary key,
  note_id uuid not null references notes(id),
  content_md text not null,
  content_hash text not null,
  reason text not null check (
    reason in ('interval', 'restore', 'pre_agent', 'manual')
  ),
  created_at timestamptz not null
)
```

Снапшот создаётся, когда выполняется хотя бы одно условие:

- прошло не менее 10 минут с предыдущего снапшота;
- `content_hash` изменился;
- причина равна `restore`;
- причина равна `pre_agent`;
- причина равна `manual`.

Для каждой заметки сохраняются 10 последних снапшотов.

Перед восстановлением старой версии создаётся снапшот текущего состояния.

Diff UI не реализуется. Поддерживается только просмотр даты версии и команда восстановления.

---

### 4.6 Tasks

```sql
tasks (
  id uuid primary key,
  workspace_id uuid not null,
  project_id uuid not null,
  note_id uuid,
  title text not null,
  body_md text not null default '',
  status text not null default 'todo'
    check (status in ('todo', 'done')),
  due_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  archived_at timestamptz,
  share_token uuid,
  created_at timestamptz not null,
  updated_at timestamptz not null,

  unique (workspace_id, id),

  foreign key (workspace_id, project_id)
    references projects (workspace_id, id),

  foreign key (workspace_id, note_id)
    references notes (workspace_id, id)
)
```

`note_id` может быть `null`:

- задача создана отдельно от заметки;
- строка задачи удалена из заметки;
- заметка была физически удалена вручную администратором.

Пользовательская архивация заметки не обнуляет `note_id`.

---

### 4.7 Canvases: canonical v0.1 contract

Legacy Canvas schema из предыдущей версии этого документа superseded ADR-0004.
Для новой реализации Canvas является отдельным workspace-scoped persistence
domain с `title`, строгим `CanvasDocumentV1`, независимым `revision`,
`deleted_at`, typed CAS и отдельным personal view state. Canvas не хранится в
workspace snapshot v2/v3; snapshot v3 не требуется.

Изображения представлены метаданными `canvas_assets`, а binary живут только в
private object storage. Canvas JSON не содержит Base64, Blob или engine-specific
snapshot. Текущий mock Canvas не является production persistence.

Полный контракт и границы checkpoint находятся в
[`docs/infinite-canvas-v0-architecture.md`](docs/infinite-canvas-v0-architecture.md),
а precedence и список superseded решений — в
[`docs/adr/0004-infinite-canvas-independent-persistence-domain.md`](docs/adr/0004-infinite-canvas-independent-persistence-domain.md).
После V2 cloud persistence checkpoint `20260801120000_canvas_document_v2_persistence.sql`
cloud canonical document — `CanvasDocumentV2`; V1 остаётся только входом для
local/client migration boundary и не принимается cloud write boundary.

The production-neutral cloud repository is an injected Supabase adapter over this
contract. It uses the existing create/save/delete RPCs, the narrow `rename_canvas`
RPC, workspace-scoped reads, server-owned revisions and authenticated RLS. Viewport
state remains a separate user-scoped stream; binary assets and Storage resolution
remain outside this repository checkpoint.

Canvas navigation groups are part of the independent Canvas persistence domain,
not the Desktop snapshot. `canvas_groups` is workspace-scoped and supports nested
groups through a composite `(workspace_id, parent_group_id)` foreign key. Canvas
membership uses the same workspace boundary, while `sort_order` is a derived
navigation ordering field. Group and Canvas mutations go through authenticated
RPCs; deleting a group archives it and promotes its direct children to the
deleted group's parent without deleting Canvas content.

The cloud asset foundation adds a private `canvas-assets` bucket and an injected
typed asset repository. Metadata is reserved and finalized through authenticated
RPCs, object paths are Canvas-scoped, and Storage policies use the metadata row
plus active Canvas membership rather than trusting path parsing alone. Canvas CAS
accepts only ready asset references belonging to the same workspace and Canvas;
binary content, URLs and upload state remain runtime-only.

### 4.8 Legacy attachments

Ранее описанная таблица `attachments` и её Canvas-specific FK больше не являются
контрактом Infinite Canvas. Она может оставаться историческим описанием общих
вложений для других доменов, но новые Canvas assets должны использовать только
`canvas_assets` и private object storage согласно ADR-0004.

---

### 4.9 Inbox items

```sql
inbox_items (
  id uuid primary key,
  workspace_id uuid not null,
  project_id uuid,
  kind text not null
    check (kind in ('text', 'audio', 'image', 'link')),
  text_content text,
  attachment_id uuid,
  transcription_status text
    check (
      transcription_status in (
        'pending',
        'processing',
        'done',
        'failed'
      )
    ),
  transcription_attempts integer not null default 0,
  transcription_error text,
  transcription_started_at timestamptz,
  transcription_completed_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,

  unique (workspace_id, id),

  foreign key (workspace_id, project_id)
    references projects (workspace_id, id),

  foreign key (workspace_id, attachment_id)
    references attachments (workspace_id, id)
)
```

После создания обеих таблиц добавляется обратная связь:

```sql
alter table attachments
add constraint attachments_inbox_item_same_workspace_fk
foreign key (workspace_id, inbox_item_id)
references inbox_items (workspace_id, id);
```

---

### 4.10 Share tokens

Для `notes` и `tasks` создаются partial unique indexes. Canvas v0.1 не
использует этот legacy share-token contract; его sharing boundary будет
определён отдельным checkpoint.

```sql
create unique index notes_share_token_unique
on notes (share_token)
where share_token is not null;
```

Аналогичные индексы создаются для остальных ресурсов.

На первой версии токены находятся непосредственно в таблицах ресурсов.

Миграционный путь при усложнении:

```sql
share_links (
  id,
  workspace_id,
  resource_type,
  resource_id,
  token,
  expires_at,
  revoked_at,
  created_at
)
```

---

## 5. Правила архивации

Пользовательское удаление:

```text
archived_at = now()
```

Для Canvas v0.1 действует отдельное правило: soft-delete хранится в
`deleted_at`, как зафиксировано в ADR-0004. `archived_at` в этом разделе
относится к legacy-моделям остальных доменов.

Физическое удаление выполняется только вручную владельцем БД или специальной административной процедурой.

Архивные записи:

- исключаются из обычных списков;
- исключаются из поиска;
- исключаются из wiki-link resolution;
- могут быть восстановлены;
- не доступны через публичный `share_token`.

Архивация заметки:

- не архивирует связанные задачи;
- не обнуляет `tasks.note_id`;
- помечает источник задачи как неактивный в UI.

RLS запрещает менять `workspace_id` существующей записи.

---

## 6. Контракт tasks ↔ Markdown

### 6.1 Источники истины

| Свойство | Источник истины |
|----------|-----------------|
| ID задачи | `tasks.id` |
| Статус | `tasks.status` |
| Название | `tasks.title` |
| Срок | `tasks.due_date` |
| Описание | `tasks.body_md` |
| Положение задачи внутри заметки | `notes.content_md` |
| Маркер `[ ]` / `[x]` | Производный кэш |

Markdown-представление:

```md
- [ ] Текст задачи ^task-550e8400-e29b-41d4-a716-446655440000
```

---

### 6.2 Создание задачи из заметки

1. TipTap создаёт task-node.
2. Клиент сразу присваивает ID через `crypto.randomUUID()`.
3. ID хранится как атрибут task-node.
4. Markdown-сериализатор добавляет `^task-<uuid>`.
5. Сохранение заметки выполняется одной серверной транзакцией:
   - проверка `version`;
   - обновление `notes`;
   - upsert задач, обнаруженных серверным Markdown-парсером;
   - обработка удалённых из заметки task ID;
   - создание снапшота при необходимости.
6. Сервер не переписывает `content_md` в ответ на сохранение.

---

### 6.3 Изменение статуса

Тоггл задачи в заметке или общем списке выполняет:

```text
UPDATE tasks.status
```

Заметка при этом не переписывается.

Маркер `[ ]` / `[x]` нормализуется:

- при следующем открытии заметки;
- при следующем сохранении;
- при экспорте;
- repair-процедурой.

---

### 6.4 Удаление task-строки

Если строка задачи удалена из заметки:

- запись `tasks` не удаляется;
- `tasks.note_id` становится `null`;
- задача остаётся в общем списке проекта.

---

### 6.5 Optimistic concurrency

Каждое сохранение заметки отправляет текущий `version`.

Сервер выполняет обновление только при совпадении версии:

```sql
update notes
set
  content_md = :content_md,
  version = version + 1
where
  id = :note_id
  and version = :expected_version;
```

Если строка не обновлена, сервер возвращает `409 Conflict`.

Клиент показывает merge-диалог и не перезаписывает чужую версию молча.

Обязательные тесты:

- две вкладки;
- переименование задачи;
- удаление task-строки;
- перенос задачи между заметками;
- изменение статуса из списка задач;
- восстановление снапшота;
- повторная отправка одной и той же мутации.

---

## 7. Markdown и TipTap

TipTap не считается источником истины.

Канонический формат:

```text
Markdown
```

Editor JSON является временным представлением текущей сессии.

### 7.1 Golden round-trip tests

Любое изменение:

- TipTap extension;
- Markdown parser;
- Markdown serializer;
- task-node;
- wiki-link extension;
- image extension;

допускается только при успешных тестах:

```text
Markdown
→ TipTap JSON
→ Markdown
```

Покрываются:

- `^task-uuid`;
- `[[wiki-links]]`;
- вложенные списки;
- task lists;
- code blocks;
- inline code;
- переносы строк;
- ссылки;
- изображения;
- таблицы, если они включены;
- кириллица;
- специальные символы;
- незнакомые конструкции;
- повторное открытие и сохранение без изменений.

Незнакомая поддерживаемая разметка не должна молча исчезать.

---

### 7.2 Wiki-links

Синтаксис:

```md
[[Название заметки]]
```

Resolution:

- только внутри текущего проекта;
- только среди неархивных заметок;
- без учёта регистра;
- название нормализуется через `lower(btrim(title))`.

При клике по несуществующей ссылке создаётся заметка с таким названием.

Активные дубли названий внутри одного проекта запрещены.

Backlinks, граф связей и автоматическое переименование wiki-ссылок находятся вне скоупа.

---

## 8. Поиск

Используется PostgreSQL FTS:

```text
russian + simple
```

`russian` обслуживает обычный русский текст.

`simple` улучшает поиск по:

- латинице;
- именам файлов;
- техническим идентификаторам;
- названиям классов;
- коду;
- UUID;
- смешанным русско-английским строкам.

Индексы:

- GIN на `search_tsv`;
- btree на `workspace_id`;
- btree на `project_id`;
- btree на `status`;
- btree на `due_date`;
- btree на `processed_at`;
- partial indexes для активных записей при необходимости.

Архивные записи не входят в обычный поиск.

Глобальный поиск открывается через `Cmd+K` / `Ctrl+K`.

Эмбеддинги и семантический поиск не входят в первую версию.

---

## 9. Безопасность и RLS

RLS включается на всех таблицах.

Проверка членства выполняется через `SECURITY DEFINER` helper-функции:

```sql
is_workspace_member(workspace_id uuid)
has_workspace_role(workspace_id uuid, roles text[])
```

Требования к helper-функциям:

- фиксированный `search_path`;
- закрытые `GRANT`;
- минимальные права;
- отсутствие динамического SQL;
- отдельные тесты;
- невозможность рекурсивного вызова RLS-политик.

### 9.1 Роли

`owner`:

- полный CRUD;
- управление участниками;
- управление share-токенами;
- восстановление архива;
- запуск экспорта.

`editor`:

- CRUD контента;
- не может управлять owner;
- не может менять роли;
- не может физически удалять данные.

`viewer`:

- read-only.

### 9.2 Инварианты

Система обязана запрещать:

- повышение editor до owner без полномочий;
- удаление последнего owner;
- изменение `workspace_id`;
- изменение `share_token` прямой клиентской мутацией;
- доступ к объекту другого workspace;
- создание child-объекта с parent из другого workspace.

Share-токены изменяются только через серверные endpoint.

---

## 10. Supabase Storage

Buckets:

```text
canvas-assets/{workspace_id}/{canvas_id}/{asset_id}/original
canvas-assets/{workspace_id}/{canvas_id}/{asset_id}/preview.webp
inbox-audio/{workspace_id}/{uuid}.webm
```

Storage policies проверяют членство в workspace.

Путь объекта не является единственным источником метаданных. Для Canvas
authoritative metadata хранится в `canvas_assets`; Canvas JSON не содержит
binary, Base64 или Blob. Bucket `canvas-assets` приватный, а object keys
детерминированы по workspace, Canvas и asset ID. Storage policy сверяет путь с
authoritative metadata и active Canvas membership.

Legacy `attachments` path относится только к другим доменам и не используется
для Canvas v0.1.

Изображения перед загрузкой:

- уменьшаются на клиенте;
- максимальная сторона — 2560 px;
- формат — WebP, если это не разрушает исходный тип;
- проходят повторную серверную проверку.

---

## 11. Лимиты файлов

| Тип | Лимит |
|-----|-------|
| Изображение | Не более 10 MB после клиентской обработки |
| Аудио | Не более 25 MB и не более 20 минут |
| Share Target | Не более 10 MB |
| Обычное вложение | Не более 25 MB |
| MIME | Только allowlist |

Клиентские лимиты используются для быстрого UX.

Сервер повторно проверяет:

- MIME;
- расширение;
- фактический размер;
- принадлежность workspace;
- допустимый тип операции.

---

## 12. Транскрипция

### 12.1 Интерфейс провайдера

Доменная логика не импортирует OpenAI SDK напрямую.

```ts
export interface TranscriptionProvider {
  transcribe(input: {
    objectPath: string
    mimeType: string
    language?: string
  }): Promise<{
    text: string
    durationSeconds?: number
    providerRequestId?: string
  }>
}
```

Первая реализация:

```text
OpenAITranscriptionProvider
```

В будущем без миграции пользовательских данных могут быть добавлены:

```text
AlternativeCloudTranscriptionProvider
SelfHostedWhisperProvider
```

Конкретный provider и модель задаются через env.

---

### 12.2 State machine

```text
pending
→ processing
→ done
  или
→ failed
```

Переход `pending → processing` выполняется атомарно:

```sql
update inbox_items
set
  transcription_status = 'processing',
  transcription_started_at = now()
where
  id = :id
  and transcription_status = 'pending';
```

Если обновлено ноль строк, параллельный обработчик не запускает повторную транскрипцию.

При ошибке:

- `transcription_status = 'failed'`;
- сохраняется безопасное описание ошибки;
- `transcription_attempts` увеличивается;
- исходное аудио не удаляется;
- пользователь видит кнопку повторной обработки.

---

## 13. PWA и офлайн

Стратегия:

```text
online-first
```

Полный offline-sync заметок и задач не реализуется.

### 13.1 Service Worker

Serwist отвечает за:

- app shell;
- статические ресурсы;
- базовую cache strategy;
- приём Web Share Target;
- поддержку Background Sync там, где он доступен.

Основная очередь Inbox живёт в коде приложения и IndexedDB, а не зависит полностью от Service Worker.

---

### 13.2 Read cache

TanStack Query сохраняет недавно открытые данные в IndexedDB.

Ключ persisted cache:

```text
user_id + workspace_id + schema_version
```

При logout:

- persisted cache очищается;
- локальная очередь проверяется на принадлежность пользователю;
- данные предыдущего пользователя не остаются доступными на общем устройстве.

Без сети разрешено читать недавно открытые заметки и задачи.

Редактирование заметок офлайн не поддерживается.

---

### 13.3 Offline Inbox queue

В IndexedDB сохраняются:

- текст;
- ссылки;
- изображения;
- аудио;
- локальный UUID;
- статус отправки;
- число попыток;
- время последней ошибки.

Порядок повторной доставки:

1. запуск приложения;
2. событие `online`;
3. возврат вкладки в foreground;
4. ручная кнопка retry;
5. Background Sync, если поддерживается.

Все операции очереди идемпотентны.

Сервер принимает клиентский UUID как idempotency key.

---

### 13.4 Web Share Target

Приложение принимает:

- текст;
- ссылки;
- изображения.

Данные сначала попадают в Inbox и не создают заметки автоматически.

---

## 14. Публичный шаринг

URL:

```text
/share/<token>
```

Правила:

- read-only;
- поиск ресурса только по токену;
- service-role клиент существует только на сервере;
- отдельные handlers для note и task; Canvas sharing не входит в v0.1 и
  потребует отдельного checkpoint;
- универсальный endpoint с передаваемым именем таблицы запрещён;
- архивный ресурс не открывается;
- токен можно отозвать и перевыпустить;
- токены не пишутся в логи;
- rate limiting обязателен.

Headers:

```http
Cache-Control: private, no-store
```

Отозванная ссылка не должна сохраняться в CDN или shared cache.

---

## 15. Бэкапы и экспорт

Бэкап БД не считается бэкапом Storage.

### 15.1 Ручной экспорт

Реализуется на этапе 1A.

Экспорт содержит:

- Markdown-файлы заметок;
- JSON проектов;
- JSON задач;
- JSON документов независимого Canvas domain;
- JSON Inbox;
- manifest вложений;
- метаданные workspace;
- версии схемы экспорта.

Минимальная структура:

```text
export/
  manifest.json
  workspace.json
  projects/
    <project-id>/
      project.json
      notes/
      tasks.json
  canvases/
    <canvas-id>/
      canvas.json
  inbox/
  canvas-assets-manifest.json
```

### 15.2 Автоматический бэкап

Реализуется на этапе 2.

GitHub Actions cron:

1. вызывает защищённый export endpoint;
2. выгружает Markdown и JSON;
3. выгружает Canvas assets по metadata из `canvas_assets`, а прочие файлы — по
   их доменным manifest-таблицам;
4. сохраняет snapshot в приватном GitHub-репозитории или S3-совместимом хранилище;
5. записывает результат и checksum;
6. сообщает об ошибке выполнения.

Секреты не попадают в экспорт.

---

## 16. Структура кода

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
          canvas/

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
      parser/
      serializer/
      task-sync/
      wiki-links/
    transcription/
      provider.ts
      openai-provider.ts
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
```

---

## 17. Разделение ответственности

Простые чтения могут выполняться с клиента через Supabase при включённом RLS.

На сервере обязательно выполняются:

- сохранение заметки и синхронизация задач;
- обработка optimistic concurrency;
- создание снапшотов;
- изменение share-токенов;
- транскрипция;
- экспорт;
- резервное копирование;
- физическая очистка данных;
- операции, затрагивающие несколько таблиц.

Критическая бизнес-логика оформляется как:

- SQL function;
- transaction;
- Route Handler;
- server action;

в зависимости от задачи.

Она не дублируется одновременно в нескольких слоях.

---

## 18. Ключевые решения для AI-агентов

Следующие решения нельзя пересматривать или менять молча:

1. Markdown — источник правды заметок.
2. TipTap JSON — временное представление редактора.
3. Задача — строка в `tasks`.
4. Task ID генерируется на клиенте.
5. Сервер не дописывает task ID обратно в Markdown.
6. `[ ]` / `[x]` — производный кэш.
7. Граница workspace защищается составными FK, RLS и кодом.
8. Пользовательское удаление означает архивацию.
9. Снапшоты создаются с throttling и hash-проверкой.
10. Изменения Markdown-пайплайна проходят golden tests.
11. Canvas persistence остаётся library-independent; engine выбирается только
    после disposable spike, а library snapshot не становится canonical data.
12. Полный offline-sync заметок не реализуется.
13. Background Sync является enhancement, а не единственным механизмом.
14. Провайдер транскрипции подключается через адаптер.
15. VPN не считается гарантией доступности внешних сервисов.
16. Backlinks, граф, realtime-коллаборация и embeddings находятся вне скоупа.

---

## 19. Вне скоупа первой версии

- realtime collaboration;
- CRDT;
- совместное редактирование заметок;
- совместное редактирование Canvas engine;
- полный offline-sync;
- конфликт-резолюция офлайн-изменений;
- backlinks;
- граф знаний;
- semantic search;
- embeddings;
- AI-генерация текста внутри редактора;
- production engine Canvas до завершения disposable spike;
- мобильные native-приложения;
- публичные каталоги workspace;
- сложные ACL на уровне отдельных заметок.

---

## 20. Роадмап

### Этап 1A — фундамент

- Supabase Auth;
- автоматическое создание workspace;
- проекты;
- заметки;
- TipTap;
- Markdown parser/serializer;
- golden round-trip tests до полноценного Editor UI;
- wiki-links;
- архивация;
- снапшоты;
- optimistic concurrency для заметок;
- FTS;
- глобальный поиск;
- RLS helper-функции;
- RLS tests;
- ручной экспорт;
- PWA-каркас.

### Этап 1B — задачи

- CRUD задач;
- task-nodes;
- клиентские task ID;
- транзакция `note + tasks`;
- lazy-нормализация checkbox-маркеров;
- перенос задачи между заметками;
- отвязка задачи при удалении строки;
- конфликт версий;
- тесты task-sync.

### Этап 2 — Inbox и устойчивость

- текстовый Inbox;
- голосовой Inbox;
- загрузка аудио;
- адаптер транскрипции;
- OpenAI provider;
- offline Inbox queue;
- Web Share Target;
- retry и idempotency;
- автоматический бэкап БД и Storage.

### Этап 3 — Infinite Canvas v0.1

- независимый workspace-scoped Canvas domain и `CanvasDocumentV1`;
- отдельные revision/CAS, view state и `canvas_assets` metadata;
- disposable engine spike и последующий engine decision;
- navigation, layout, nodes, assets и edges по checkpoint-плану
  [`docs/infinite-canvas-v0-architecture.md`](docs/infinite-canvas-v0-architecture.md);
- публичный Canvas sharing не входит в v0.1 и не получает legacy share-token schema.

### Этап 4 — развитие продукта

- daily notes;
- полноценный раздел архива;
- мониторинг размера БД;
- мониторинг Storage;
- инструменты восстановления;
- полировка мобильного UX;
- диагностика сетевого маршрута;
- возможность второго транскрипционного провайдера.

---

## 21. Решения владельца продукта

### 21.1 Уникальность названий заметок

Внутри одного проекта запрещены две активные заметки с одинаковым
нормализованным названием.

При попытке создать дубликат приложение предлагает открыть существующую
заметку.

### 21.2 Порядок этапов 1A и 1B

Сначала создаётся надёжный Markdown-пайплайн и редактор.

Связка задач с Markdown добавляется только после прохождения
round-trip tests.

### 21.3 Регион инфраструктуры

Пользователь физически работает из России через европейский VPN.

Стартовый регион — Frankfurt, если latency-тест подтверждает приемлемую
и стабильную задержку между:

- клиентом через VPN;
- Vercel;
- Supabase;
- внешними API.

Регион не выбирается только по физическому адресу пользователя или
текущему IP VPN.

---

## 22. Definition of Done для архитектурных изменений

Изменение архитектуры считается принятым только если:

1. обновлён этот файл;
2. при необходимости создан ADR;
3. добавлена Supabase migration;
4. обновлены generated DB types;
5. добавлены или обновлены тесты;
6. описан путь миграции существующих данных;
7. проверены RLS и workspace boundaries;
8. не нарушены Markdown round-trip tests;
9. не появилась новая внешняя незаменяемая зависимость;
10. изменение попало в changelog.

---

## Changelog

### v1.2

- Уточнено, что пользователь физически находится в России и работает через европейский VPN.
- Frankfurt оставлен стартовым кандидатом, но выбор региона привязан к latency-тесту полного маршрута.
- VPN зафиксирован как эксплуатационная схема, а не гарантия доступности.
- Транскрипция вынесена за интерфейс `TranscriptionProvider`.
- OpenAI оставлен первой реализацией, но не доменной зависимостью.
- Уточнена схема attachments и Inbox.
- Добавлены idempotency и правила offline queue.
- Согласованы этапы 1A, 1B, 2, 3 и 4.
- Документ очищен от рецензионных комментариев и превращён в итоговую архитектурную спецификацию.

### v1.1

- Добавлены составные FK для границ workspace.
- Добавлен `archived_at`.
- Зафиксирован транзакционный контракт tasks ↔ Markdown.
- Добавлены клиентские task ID и optimistic concurrency.
- Добавлена уникальность названий заметок.
- Добавлены golden round-trip tests.
- Добавлен throttling снапшотов.
- Добавлены RLS helper-функции.
- Удалён `owner_id`.
- Добавлена таблица attachments.
- FTS расширен до `russian + simple`.
- Снапшоты и экспорт перенесены в начало roadmap.
- `next-pwa` заменён на Serwist.
