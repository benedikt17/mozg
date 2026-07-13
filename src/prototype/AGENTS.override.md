# Prototype agent rules

`src/prototype/**` — изолированный mock-only UX-прототип. Он не является production persistence model; состояние сбрасывается после reload.

## Контекст задачи

- Канонический desktop prototype: route `/prototype/desktop`.
- Текущий implementation source: `prototype/desktop-project-overview` и его stacked stabilization branches.
- PR #5 — более раннее исследование. Не использовать его как источник реализации без прямого указания владельца.
- Для prototype-задачи сначала читать текущую задачу, непосредственно связанные файлы и tests.
- Migrations, RLS tests и полный `ARCHITECTURE.md` не нужно читать, пока изменение не пересекает границу production code, persistence, Markdown contract, security или нескольких domains.

## Границы

- Не добавлять из prototype-задачи Supabase schema, persistence, autosave, TipTap integration, production task synchronization или Stage 1A-5 behavior.
- Предпочитать минимальное безопасное изменение.
- Не исследовать и не рефакторить несвязанные prototype sections.
- Сохранять текущее поведение, если задача явно не меняет его.
- Несвязанные дефекты указывать в отчёте, не исправляя их молча.
- Во время итерации использовать targeted tests; перед завершением выполнить применимые gates из root `AGENTS.md`.

## Текущие контракты

- Overview и Tasks используют одни mock task records.
- `overviewDirectionId` определяет направление Overview.
- `overviewOrder` означает только ручной порядок внутри этого направления.
- Tasks filters: `all`, `important`, `completed`.
- Completed tasks доступны в Tasks и исключены из Overview.
- AI временно заменяет текущий Context Panel; закрытие AI восстанавливает предыдущий panel.
- Перемещение задачи в направление другого project запрещено.

## Известные hotspots

- `desktop-shell.tsx` oversized.
- `desktop-state.ts` объединяет несколько feature domains.
- `TaskCard` объединяет click, double-click, inline editing, DnD и suppression logic.
- CSS ownership разделён между shell и workspace override files.

Эти hotspots не решаются в рамках несвязанной локальной задачи.
