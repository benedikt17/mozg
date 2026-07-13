# Desktop prototype status

- Canonical route: `/prototype/desktop`.
- Canonical development line: `prototype/desktop-project-overview` (Draft PR #6), текущая stacked stabilization — `refactor/prototype-model-cleanup` (Draft PR #7).
- Prototype mock-only: persistence отсутствует, состояние сбрасывается после reload.
- Sections: Overview, Knowledge, Tasks, Canvases и Inbox.
- Overview и Tasks используют одни mock task records; Tasks filters: `all`, `important`, `completed`.
- Overview directions project-local: `overviewDirectionId` выбирает направление, `overviewOrder` задаёт только ручной порядок внутри него.
- Completed tasks остаются в Tasks и исключены из Overview.
- Context Panel показывает один contextual view; AI временно заменяет его и восстанавливает предыдущий panel при закрытии.
- Cleanup milestones и obsolete Overview filters завершён.

## Known technical debt

- `desktop-shell.tsx` oversized.
- `desktop-state.ts` объединяет несколько feature domains.
- `TaskCard` объединяет click, double-click, editing, DnD и suppression logic.
- CSS ownership разделён между shell и workspace override files.

Следующий planned refactor: ограниченная декомпозиция prototype shell/state hotspots с characterization tests и без изменения product behavior.

Прототип не изменяет Supabase, migrations, RLS, generated database types, production persistence, TipTap, autosave, task synchronization или Stage 1A-5.
