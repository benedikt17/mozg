-- Stage 3.3 / Phase 1: introduce Project ownership without changing existing
-- Canvas runtime behavior.
--
-- Product Project ids are currently authoritative in Desktop Snapshot V3, not
-- in public.projects. Keep project_id nullable during the compatibility phase:
-- existing RPCs do not know the active Project yet and must continue to work.
-- Production legacy rows are backfilled explicitly during rollout after their
-- workspace and row counts are re-verified; do not infer ownership here.

alter table public.canvas_groups
  add column if not exists project_id text;

alter table public.canvases
  add column if not exists project_id text;

alter table public.canvas_groups
  add constraint canvas_groups_project_id_format_check
  check (
    project_id is null
    or (
      btrim(project_id) <> ''
      and char_length(project_id) <= 256
      and project_id !~ '[[:cntrl:]]'
    )
  );

alter table public.canvases
  add constraint canvases_project_id_format_check
  check (
    project_id is null
    or (
      btrim(project_id) <> ''
      and char_length(project_id) <= 256
      and project_id !~ '[[:cntrl:]]'
    )
  );

create index canvas_groups_workspace_project_parent_sort_idx
  on public.canvas_groups (workspace_id, project_id, parent_group_id, sort_order, id)
  where deleted_at is null;

create index canvases_workspace_project_updated_idx
  on public.canvases (workspace_id, project_id, updated_at desc, id)
  where deleted_at is null;

comment on column public.canvas_groups.project_id is
  'Desktop Snapshot Project id. Nullable only during Stage 3.3 compatibility rollout.';

comment on column public.canvases.project_id is
  'Desktop Snapshot Project id. Nullable only during Stage 3.3 compatibility rollout.';
