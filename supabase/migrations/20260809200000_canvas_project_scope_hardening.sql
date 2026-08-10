-- Stage 3.4C: make Project ownership mandatory and enforce Canvas hierarchy
-- boundaries at the database layer.
--
-- project_id is an opaque Desktop Snapshot Project id. It is intentionally not
-- a foreign key to public.projects: Desktop Snapshot V3 remains authoritative
-- for Product Projects.

-- Refuse to harden a database that still contains transitional or inconsistent
-- rows. Production is expected to pass these checks before rollout.
do $$
begin
  if exists (select 1 from public.canvases where project_id is null) then
    raise exception using
      errcode = '23502',
      message = 'Canvas project hardening blocked: canvases.project_id contains NULL';
  end if;

  if exists (select 1 from public.canvas_groups where project_id is null) then
    raise exception using
      errcode = '23502',
      message = 'Canvas project hardening blocked: canvas_groups.project_id contains NULL';
  end if;

  if exists (
    select 1
      from public.canvases as canvas
      join public.canvas_groups as group_row on group_row.id = canvas.group_id
     where canvas.group_id is not null
       and (
         canvas.workspace_id <> group_row.workspace_id
         or canvas.project_id <> group_row.project_id
       )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Canvas project hardening blocked: cross-project Canvas group link exists';
  end if;

  if exists (
    select 1
      from public.canvas_groups as child_group
      join public.canvas_groups as parent_group
        on parent_group.id = child_group.parent_group_id
     where child_group.parent_group_id is not null
       and (
         child_group.workspace_id <> parent_group.workspace_id
         or child_group.project_id <> parent_group.project_id
       )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Canvas project hardening blocked: cross-project Canvas group parent link exists';
  end if;
end;
$$;

alter table public.canvases
  alter column project_id set not null;

alter table public.canvas_groups
  alter column project_id set not null;

comment on column public.canvases.project_id is
  'Required Desktop Snapshot Project id. Canvas rows are strictly Project-scoped.';
comment on column public.canvas_groups.project_id is
  'Required Desktop Snapshot Project id. Canvas groups are strictly Project-scoped.';

-- Composite target key used by both project-bound hierarchy foreign keys.
alter table public.canvas_groups
  add constraint canvas_groups_workspace_project_id_key
  unique (workspace_id, project_id, id);

-- Add and validate the stronger constraints before removing the old
-- workspace-only constraints.
alter table public.canvases
  add constraint canvases_group_workspace_project_fkey
  foreign key (workspace_id, project_id, group_id)
  references public.canvas_groups (workspace_id, project_id, id)
  on delete restrict
  not valid;

alter table public.canvases
  validate constraint canvases_group_workspace_project_fkey;

alter table public.canvas_groups
  add constraint canvas_groups_parent_workspace_project_fkey
  foreign key (workspace_id, project_id, parent_group_id)
  references public.canvas_groups (workspace_id, project_id, id)
  on delete restrict
  not valid;

alter table public.canvas_groups
  validate constraint canvas_groups_parent_workspace_project_fkey;

alter table public.canvases
  drop constraint canvases_group_workspace_fkey;

alter table public.canvas_groups
  drop constraint canvas_groups_parent_workspace_fkey;

-- Keep the existing public signatures used by the project-scoped repository,
-- but make the mutation itself Project-aware as a defence-in-depth boundary.
create or replace function public.move_canvas_group(
  target_group_id uuid,
  target_parent_group_id uuid
)
returns setof public.canvas_groups
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_workspace_id uuid;
  target_project_id text;
  next_sort_order bigint;
begin
  select group_row.workspace_id, group_row.project_id
    into target_workspace_id, target_project_id
    from public.canvas_groups as group_row
   where group_row.id = target_group_id
     and group_row.deleted_at is null;

  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas group access denied';
  end if;

  if target_parent_group_id is not null and not exists (
    select 1
      from public.canvas_groups as group_row
     where group_row.id = target_parent_group_id
       and group_row.workspace_id = target_workspace_id
       and group_row.project_id = target_project_id
       and group_row.deleted_at is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'Parent Canvas group is unavailable in project';
  end if;

  if target_parent_group_id = target_group_id or exists (
    with recursive descendants(id) as (
      select group_row.id
        from public.canvas_groups as group_row
       where group_row.id = target_group_id
         and group_row.workspace_id = target_workspace_id
         and group_row.project_id = target_project_id
      union all
      select child.id
        from public.canvas_groups as child
        join descendants as parent on parent.id = child.parent_group_id
       where child.workspace_id = target_workspace_id
         and child.project_id = target_project_id
         and child.deleted_at is null
    )
    select 1 from descendants where descendants.id = target_parent_group_id
  ) then
    raise exception using errcode = '22023', message = 'Canvas group cycle is not allowed';
  end if;

  select coalesce(max(group_row.sort_order) + 1, 0)
    into next_sort_order
    from public.canvas_groups as group_row
   where group_row.workspace_id = target_workspace_id
     and group_row.project_id = target_project_id
     and group_row.parent_group_id is not distinct from target_parent_group_id
     and group_row.deleted_at is null
     and group_row.id <> target_group_id;

  return query
  update public.canvas_groups as group_row
     set parent_group_id = target_parent_group_id,
         sort_order = next_sort_order
   where group_row.id = target_group_id
     and group_row.deleted_at is null
  returning group_row.*;
end;
$$;

create or replace function public.move_canvas_to_group(
  target_canvas_id uuid,
  target_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_workspace_id uuid;
  target_project_id text;
  next_sort_order bigint;
begin
  select canvas.workspace_id, canvas.project_id
    into target_workspace_id, target_project_id
    from public.canvases as canvas
   where canvas.id = target_canvas_id
     and canvas.deleted_at is null;

  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas access denied';
  end if;

  if target_group_id is not null and not exists (
    select 1
      from public.canvas_groups as group_row
     where group_row.id = target_group_id
       and group_row.workspace_id = target_workspace_id
       and group_row.project_id = target_project_id
       and group_row.deleted_at is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'Canvas group is unavailable in project';
  end if;

  select coalesce(max(canvas.sort_order) + 1, 0)
    into next_sort_order
    from public.canvases as canvas
   where canvas.workspace_id = target_workspace_id
     and canvas.project_id = target_project_id
     and canvas.group_id is not distinct from target_group_id
     and canvas.deleted_at is null
     and canvas.id <> target_canvas_id;

  update public.canvases as canvas
     set group_id = target_group_id,
         sort_order = next_sort_order
   where canvas.id = target_canvas_id
     and canvas.deleted_at is null;
end;
$$;

-- Workspace-only creation remains in the schema solely as rollback-compatible
-- historical surface. It is no longer executable by application roles.
revoke all on function public.create_canvas(uuid, text)
  from public, anon, authenticated;
revoke all on function public.create_canvas(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.create_canvas_group(uuid, text, uuid)
  from public, anon, authenticated;

comment on function public.create_canvas(uuid, text) is
  'DEPRECATED Stage 3.4C: workspace-only Canvas creation; application EXECUTE revoked.';
comment on function public.create_canvas(uuid, text, uuid) is
  'DEPRECATED Stage 3.4C: workspace-only Canvas creation; application EXECUTE revoked.';
comment on function public.create_canvas_group(uuid, text, uuid) is
  'DEPRECATED Stage 3.4C: workspace-only Canvas group creation; application EXECUTE revoked.';
