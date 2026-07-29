# ADR-0001: Минимальная cloud-архитектура первой версии MOZG

- Status: accepted
- Date: 2026-07-29

## Context

Текущий desktop prototype хранит domain state в client-side reducer и
сохраняет его через IndexedDB. Это обеспечивает локальную работу одного
браузера, но не даёт общего состояния для пользователя, работающего на
нескольких компьютерах.

Полевой запуск проекта «Лукоморье» требует:

- одного общего server-side состояния;
- доступа через интернет и HTTPS;
- последовательной работы с нескольких устройств;
- защиты от незаметной перезаписи изменений.

Сейчас Supabase foundation уже содержит `workspaces`,
`workspace_members`, базовые RLS helpers, projects и notes. Desktop snapshot
в Supabase пока не хранится. IndexedDB остаётся текущим persistence-слоем
prototype.

Долгосрочная production-архитектура в [`ARCHITECTURE.md`](../../ARCHITECTURE.md)
описывает нормализованные сущности, включая SQL-строки задач и заметок.
Первый cloud-релиз не должен заранее оплачивать стоимость полной нормализации
всех prototype-сущностей, но временное решение не должно незаметно заменить
долгосрочную модель.

## User requirement

Пользователь должен иметь возможность войти в MOZG и последовательно работать
с одним primary workspace на нескольких компьютерах. Состояние должно быть
общим, а устаревшее сохранение на одном устройстве не должно молча затирать
более новую серверную версию.

## Decision

Для первого cloud-релиза принимается временный JSONB cloud bridge:

- один заранее созданный пользователь;
- один primary workspace без workspace switcher;
- один server-side `DesktopDomainSnapshot` на workspace;
- schema version внутри snapshot;
- optimistic concurrency через серверную `revision`;
- Supabase является источником истины после успешного первого импорта;
- IndexedDB хранит последний подтверждённый server snapshot и может быть
  источником явного первого импорта или аварийной копией;
- realtime, CRDT, granular merge и полноценный offline-sync не реализуются;
- конфликт сохраняется как явный conflict, а не разрешается через
  last-write-wins.

Это решение является cloud bridge для текущего prototype-контракта. Оно не
отменяет нормализованную production-модель из `ARCHITECTURE.md`. Переход к
нормализованным таблицам остаётся отдельным архитектурным этапом с отдельным
планом миграции.

## Chosen architecture

### Scope

В scope первой cloud-версии входят:

- single-user;
- multi-device;
- один primary workspace;
- один общий server snapshot;
- HTTPS-доступ;
- последовательная работа с нескольких компьютеров;
- защита от silent overwrite.

За пределами scope остаются публичная регистрация, команды, пользовательские
роли в UI, sharing, collaboration, realtime, CRDT, granular merge,
полноценный offline-sync, Supabase Storage и нормализация всех prototype-
сущностей по отдельным SQL-таблицам.

### Auth

Используется email/password для одного пользователя, созданного заранее.
Публичная регистрация, password reset и self-service signup не входят в
первый scope.

Маршрут `/prototype/desktop` должен быть защищён server-side session boundary.
Browser не получает service-role key. Обычный snapshot flow выполняется от
имени authenticated session и проходит через RLS.

### Workspace ownership

`workspace_id` остаётся явным в server contract. Используются существующие
`workspaces` и `workspace_members` как authorization boundary. Пользователь
имеет owner membership. Поле `owner_id` в snapshot table не добавляется:
принадлежность уже определяется membership-записью.

### Server schema

Минимальная таблица:

```text
workspace_snapshots
-------------------
workspace_id   uuid primary key references workspaces(id)
schema_version smallint not null
snapshot       jsonb not null
revision       bigint not null
created_at     timestamptz not null
updated_at     timestamptz not null
```

Семантика полей:

- `workspace_id` — единственный snapshot для workspace;
- `schema_version` — версия контракта `DesktopDomainSnapshot`;
- `snapshot` — валидируемая domain-полезная нагрузка;
- `revision` — монотонная серверная версия для optimistic concurrency;
- `created_at` и `updated_at` — аудит и диагностика.

RLS фиксируется так:

- политики применяются только к `authenticated`;
- читать snapshot может участник workspace;
- создавать и изменять snapshot может owner;
- публичный и anonymous доступ отсутствуют;
- удаление запрещается либо разрешается только owner;
- RLS не заменяет server-side schema и domain validation.

Точные SQL-политики и форма миграции относятся к следующему Schema/RLS
checkpoint. Эта ADR не создаёт миграцию.

### CAS save contract

Клиент отправляет snapshot и `expectedRevision`. Сервер выполняет атомарное
обновление только при совпадении текущей `revision` с ожидаемой:

```text
UPDATE workspace_snapshots
SET snapshot = :snapshot,
    schema_version = :schema_version,
    revision = revision + 1,
    updated_at = now()
WHERE workspace_id = :workspace_id
  AND revision = :expected_revision
RETURNING revision, updated_at
```

При успехе клиент получает новую revision. При несовпадении сервер возвращает
отдельный conflict-result. Клиент не повторяет сохранение автоматически с
новой revision: пользователь сначала загружает актуальную серверную версию.

Эта ADR фиксирует семантику, но не выбирает окончательную механическую форму
между direct filtered update и RPC. Выбор будет сделан на Schema/RLS
checkpoint после проверки существующих Supabase helpers, RLS и поведения
возврата обновлённой строки. RPC нужен только если он действительно требуется
для транзакционной логики или корректного сохранения boundary; service-role key
для CAS не нужен.

Ошибки должны быть различимы:

- `conflict` — revision устарела;
- `auth` — нет действительной authenticated session;
- `network` — сервер недоступен;
- `invalid-snapshot` — snapshot не прошёл validation;
- `unsupported-version` — runtime не поддерживает schema version.

### IndexedDB and source of truth

После перехода на cloud Supabase является источником истины. IndexedDB:

- хранит последний подтверждённый server snapshot;
- используется для явного первого импорта;
- может служить аварийной локальной копией;
- не является автоматически синхронизируемой offline-write очередью.

Локальный revision не считается server revision без подтверждения от сервера.
Кэш обновляется только после успешной загрузки или успешного server save.

### Startup state machine

#### Server snapshot существует

1. Server snapshot валидируется.
2. Он полностью заменяет seed state.
3. IndexedDB не смешивается с сервером.
4. После успешной загрузки обновляется локальный cache.

#### Server пуст, IndexedDB содержит данные

1. Пользователю показывается явное предложение импорта.
2. Импорт не выполняется автоматически.
3. После подтверждения создаётся server snapshot с revision 1.
4. Только после успешного импорта сервер становится источником истины.

#### Server пуст, IndexedDB пуст

Mock seed не сохраняется автоматически. Показывается короткий initial setup,
в котором пользователь задаёт название первого проекта. Затем создаётся
минимальный валидный workspace через существующую project creation/domain
logic.

#### Server snapshot invalid

Snapshot не гидрируется и не перезаписывается локальной копией. Показывается
безопасная ошибка. Восстановление и export относятся к отдельному этапу.

### Offline semantics

При недоступном сервере приложение показывает последний подтверждённый cache,
явно сообщает об отсутствии соединения и отключает редактирование либо
переходит в read-only режим. Новые unsynced offline changes не создаются.

Это сознательное ограничение первой версии: полноценная offline-write очередь
потребовала бы отдельного sync-протокола, conflict policy и тестового набора.

### Conflict UX

Минимальный flow:

- показать `Данные изменились на другом устройстве`;
- предложить загрузить серверную версию;
- предложить экспортировать или сохранить локальную копию;
- не выполнять автоматический merge;
- не запускать бесконечный retry;
- не перезаписывать сервер локальной версией молча.

### Deployment

Направление deployment — Vercel + Supabase:

- Production и Preview environments разделены;
- Production использует отдельные environment variables;
- production data не подключаются к Preview автоматически;
- Supabase Auth redirect URLs ограничиваются конкретными разрешёнными URL;
- HTTPS обязателен;
- production acceptance выполняется минимум на двух компьютерах.

Регион Supabase выбирается по измеренному полному маршруту клиент → VPN →
Vercel → Supabase. Frankfurt остаётся стартовым кандидатом согласно текущей
архитектуре, но не считается безусловно подтверждённым до измерения.

## Alternatives considered

### IndexedDB only

Отклонено для cloud-релиза: не даёт общего server state и не решает работу
на нескольких компьютерах. Сохраняется как локальный cache/import layer.

### Normalized database immediately

Отложено: лучше совпадает с долгосрочной production-моделью, но требует сразу
реализовать и протестировать нормализованные tasks, notes, relations,
Knowledge-модель, migrations, RLS и migration path из prototype snapshot.
Это непропорционально увеличивает стоимость первого field release.

### Realtime/offline-first

Отклонено для первого релиза: не требуется для последовательной работы одного
пользователя и добавляет sync, merge, reconnect и conflict complexity.

### JSONB bridge

Принято как временный bridge: он переиспользует существующий
`DesktopDomainSnapshot`, даёт один server source of truth и CAS с небольшой
поверхностью изменений. Цена решения — полные snapshot writes, будущая
migration debt и необходимость пересмотра при росте продукта.

## Consequences

### Positive

- Пользователь получает одно состояние на нескольких компьютерах.
- Silent overwrite защищён server-side revision check.
- Первый cloud checkpoint не требует нормализации всех prototype-сущностей.
- Существующий snapshot serializer и persistence boundary остаются полезными.
- Supabase RLS сохраняет workspace isolation.
- Нет необходимости в realtime, CRDT или service-role операции.

### Negative

- Каждое сохранение передаёт полный snapshot.
- Нет автоматического merge конфликтующих изменений.
- При потере сети редактирование недоступно.
- JSONB-схема слабее нормализованной модели для granular queries и FTS.
- Появляется временный cloud-to-production migration debt.
- Auth требует server-side session boundary и отдельной настройки email/password.

### Deferred cost

Пересмотр потребуется при росте snapshot size/latency, появлении granular
queries или search, нескольких пользователях, sharing, realtime collaboration,
обязательном offline editing, усложнении schema migrations или необходимости
частичных server-side updates.

## Security boundaries

- Пользователь проходит authenticated session до доступа к desktop route.
- Supabase RLS является обязательной защитой таблицы snapshot.
- `workspace_id` проверяется через membership, а не доверяется только UI.
- Browser не получает service-role key.
- Snapshot валидируется на server boundary независимо от client validation.
- Public и anonymous access к snapshot отсутствуют.
- Production и Preview используют разные environment values и data boundaries.

## Data ownership and source of truth

До успешного первого импорта локальный IndexedDB snapshot принадлежит
локальному браузеру и не загружается автоматически. После успешного импорта
или server load источником истины становится Supabase snapshot. IndexedDB
содержит только последнюю подтверждённую server-версию либо локальную копию,
предложенную для явного импорта/export.

## Import semantics

Первый импорт является явным пользовательским действием. Server-empty + local-
non-empty не означает разрешение на автоматическую загрузку. Импорт создаёт
snapshot revision 1 после server-side validation. Если между проверкой и
импортом snapshot уже появился, операция считается conflict и не перезаписывает
существующую server-версию.

## Revisit triggers

Решение пересматривается, если выполняется хотя бы одно условие:

- размер snapshot или latency становятся заметными для UX;
- требуются granular queries или search;
- появляются несколько пользователей;
- требуется sharing;
- требуется realtime collaboration;
- offline editing становится обязательным;
- domain schema migrations становятся слишком сложными;
- требуется частичное server-side обновление сущностей.

## Implementation milestones

|   # | Milestone                          | Пользовательский результат                                | Граница milestone                                                 |
| --: | ---------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
|   1 | ADR                                | Принято понятное cloud-решение и его ограничения          | Только документация, без production code                          |
|   2 | Schema/RLS foundation              | Server может безопасно хранить один snapshot workspace    | Новая migration, generated types и RLS tests; без UI sync         |
|   3 | Email/password Auth boundary       | Пользователь входит, публичная регистрация закрыта        | Auth/session boundary; без remote domain writes                   |
|   4 | Authenticated read-only cloud load | На другом компьютере виден server snapshot                | Только load/hydration; локальный import ещё не автоматизируется   |
|   5 | CAS remote save                    | Последовательные изменения сохраняются между компьютерами | CAS и error mapping; без merge и offline queue                    |
|   6 | Explicit IndexedDB import          | Существующие локальные данные можно один раз перенести    | Явное подтверждение, revision 1, no silent overwrite              |
|   7 | Conflict/offline UX                | Пользователь понимает conflict и состояние сети           | Reload server, local export/copy, read-only offline               |
|   8 | Vercel deployment                  | Приложение доступно через HTTPS в разделённых окружениях  | Deployment configuration and smoke checks                         |
|   9 | Two-computer acceptance            | Реально подтверждена работа через два компьютера          | Sequential save, stale conflict, auth and import checks           |
|  10 | Cloud baseline commit              | Cloud checkpoint воспроизводим и принят                   | Полная validation, один атомарный commit; отдельное подтверждение |

## Explicit non-goals

Первый cloud-релиз не включает:

- публичную регистрацию;
- команды и UI для ролей;
- sharing и collaboration;
- realtime;
- CRDT;
- granular merge;
- полноценный offline-sync;
- offline-write queue;
- Supabase Storage;
- нормализацию всех prototype-сущностей по SQL-таблицам;
- автоматический merge IndexedDB и server snapshot;
- last-write-wins для конфликтов;
- массовую performance-оптимизацию без измеренного hotspot.

## Migration plan

Эта ADR не создаёт migration и не меняет production code.

На Schema/RLS checkpoint будет добавлена новая migration для
`workspace_snapshots`, обновлены generated types и добавлены RLS/workspace
boundary tests. Existing IndexedDB snapshots не удаляются.

На import checkpoint локальный `DesktopDomainSnapshot` будет провалидирован и
явно записан в server snapshot revision 1. Server snapshot после этого станет
источником истины.

Переход к долгосрочной нормализованной production-модели выполняется только
отдельным ADR с:

- mapping snapshot collections на SQL-сущности;
- dual-read или controlled export/import strategy;
- проверяемой миграцией существующих task/document IDs и relations;
- rollback/backup plan;
- RLS и integrity tests.
