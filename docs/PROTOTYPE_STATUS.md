# Desktop prototype status

- Canonical route: `/prototype/desktop`.
- Current baseline scope: Overview, Knowledge и Tasks.
- Inbox и Canvases заморожены, не входят в текущий release scope, а их dirty
  changes не должны автоматически включаться в baseline commit.

## Local persistence

Прототип сохраняет domain data в локальную IndexedDB базу
`mozg-desktop-prototype` через versioned snapshot schema. В snapshot входят:

- projects;
- Overview directions и order;
- task groups, task lists, tasks и subtasks;
- Knowledge folders и documents/Markdown;
- task-document relations;
- task links в пределах текущего snapshot contract.

Session-only UI state может не восстанавливаться после reload. IndexedDB является
локальным prototype persistence и не является production database. Snapshot schema
не является Supabase production contract. В дальнейшем потребуется versioned
idempotent import adapter в Supabase; такой adapter пока не реализован.

## Accepted MVP UI contract

### Overview

- Task cards, expand/details flow, общий task-details content, article reader,
  completion и drag-and-drop.
- В режиме «Подробнее» нет duplicate right task panel.

### Tasks

- Task lists, filters (`all`, `important`, `completed`) и groups.
- Используется общий с Overview `TaskDetailsPanel`.
- Порядок секций: Подзадачи, Статьи, Ссылки.
- Primary task title редактируется в details panel; task row только выбирает
  задачу.
- Tasks DnD функционально принят: drag preview, единый insertion target
  `{ listId, index }`, layout insertion slot и текущий cross-list scope.
- Дальнейшая идеальная визуальная полировка indicator не входит в baseline.

### Knowledge

- Folders/documents, Primary/Split, internal/external links и nested checklists.
- Collapse branches и task-scoped article attachment.
- Split закрывается перед открытием attach panel.

## Production readiness gaps

Прототип не готов к production deployment. Пока отсутствуют или не завершены:

- Google Auth;
- protected production routes;
- workspace bootstrap UI;
- production repositories/adapters;
- полная Tasks Supabase schema;
- RLS для Tasks и новых relations;
- IndexedDB → Supabase migration;
- staging/production separation;
- production backup/restore flow.

## Known technical debt

- `desktop-shell.tsx` oversized.
- `desktop-state.ts` объединяет несколько feature domains.
- `TaskCard` объединяет click, double-click, editing, DnD и suppression logic.
- CSS ownership разделён между shell и workspace override files.

Технический долг не меняет принятый MVP scope и не является частью этого
documentation baseline.
