# Prototype agent rules

`src/prototype/**` — изолированный UX-прототип с локальным IndexedDB persistence.
Он не является production database или Supabase persistence model.

## Контекст задачи

- Канонический desktop prototype: route `/prototype/desktop`.
- Активный MVP scope: Overview, Knowledge и Tasks.
- Inbox и Canvases заморожены и не входят в текущий release scope. Их dirty
  changes нельзя автоматически включать в baseline commit.
- Для prototype-задачи сначала читать текущую задачу, непосредственно связанные
  файлы и tests.
- Migrations, RLS tests и полный `ARCHITECTURE.md` не нужно читать, пока изменение
  не пересекает границу production code, persistence, Markdown contract,
  security или нескольких domains.

## IndexedDB contract

- Локальная база прототипа: `mozg-desktop-prototype`.
- Domain data сохраняется в versioned snapshot schema.
- Snapshot включает projects, Overview directions/order, task groups, task lists,
  tasks, subtasks, Knowledge folders, Markdown documents, task-document
  relations и task links в пределах текущего snapshot contract.
- Session-only UI state может не восстанавливаться после reload.
- IndexedDB — локальное prototype persistence, а не production database.
- Snapshot schema не является Supabase production contract.
- Позднее потребуется versioned idempotent import adapter в Supabase; такой
  импорт пока не реализован.

## Принятые UI-контракты

### Overview

- Task cards, expand/details flow, общий task-details content, article reader,
  completion и drag-and-drop.
- В режиме «Подробнее» общий правый task-details panel не дублируется.

### Tasks

- Task lists, filters (`all`, `important`, `completed`) и groups.
- Overview и Tasks используют одни canonical task records и общий
  `TaskDetailsPanel`.
- В `TaskDetailsPanel` порядок секций: Подзадачи, Статьи, Ссылки.
- Primary task title редактируется в details panel; task row только выбирает
  задачу.
- DnD функционально принят: native drag preview, единый insertion target
  `{ listId, index }`, layout insertion slot и текущий cross-list scope.
- Идеальная визуальная полировка indicator не является частью baseline.

### Knowledge

- Folders/documents, Primary/Split, internal/external links и nested checklists.
- Поддерживаются collapse branches, task-scoped article attachment и закрытие
  Split перед открытием attach panel.

## Границы

- Не добавлять из prototype-задачи production Supabase schema, RLS, production
  repositories/adapters или production task synchronization.
- Не менять persistence schema без отдельного согласованного контракта.
- Предпочитать минимальное безопасное изменение.
- Не исследовать и не рефакторить несвязанные prototype sections.
- Сохранять текущее поведение, если задача явно не меняет его.
- Несвязанные дефекты указывать в отчёте, не исправляя их молча.
- Во время итерации использовать targeted tests; перед завершением выполнить
  применимые gates из root `AGENTS.md`.

## Известные hotspots

- `desktop-shell.tsx` oversized.
- `desktop-state.ts` объединяет несколько feature domains.
- `TaskCard` объединяет click, double-click, inline editing, DnD и suppression
  logic.
- CSS ownership разделён между shell и workspace override files.

Эти hotspots не решаются в рамках несвязанной локальной задачи.
