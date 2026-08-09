-- Stage 3.3 / Phase 2: add explicit Project-scoped creation APIs while the
-- legacy workspace-only RPCs remain available for rollback compatibility.
--
-- Desktop Snapshot V3 is currently authoritative for Product Projects. The DB
-- stores its stable project id as an opaque partition key. We intentionally do
-- not validate project existence against the snapshot here: snapshot persistence
-- and Canvas creation are separate async operations, so such a check would add a
-- false ordering dependency. Format and workspace membership are still enforced.

create or replace function private.assert_canvas_project_id_format(
  target_project_id text
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if target_project_id is null
     or btrim(target_project_id) = ''
     or char_length(target_project_id) > 256
     or target_project_id ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'invalid Canvas project id';
  end if;
end;
$$;

revoke all on function private.assert_canvas_project_id_format(text)
  from public, anon, authenticated;

create or replace function public.create_canvas_for_project(
  target_workspace_id uuid,
  target_project_id text,
  target_title text,
  target_group_id uuid default null
)
returns table (id uuid, revision bigint)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  next_sort_order bigint;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'workspace access denied';
  end if;
  perform private.assert_canvas_project_id_format(target_project_id);
  perform public.assert_canvas_title(target_title);

  if target_group_id is not null and not exists (
    select 1
    from public.canvas_groups as group_row
    where group_row.id = target_group_id
      and group_row.workspace_id = target_workspace_id
      and group_row.project_id = target_project_id
      and group_row.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'Canvas group is unavailable in project';
  end if;

  select coalesce(max(canvas.sort_order) + 1, 0)
    into next_sort_order
    from public.canvases as canvas
   where canvas.workspace_id = target_workspace_id
     and canvas.project_id = target_project_id
     and canvas.group_id is not distinct from target_group_id
     and canvas.deleted_at is null;

  return query
  insert into public.canvases (
    workspace_id,
    project_id,
    group_id,
    sort_order,
    title,
    schema_version,
    document,
    revision,
    created_by
  )
  values (
    target_workspace_id,
    target_project_id,
    target_group_id,
    next_sort_order,
    target_title,
    2,
    '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb,
    1,
    (select auth.uid())
  )
  returning canvases.id, canvases.revision;
end;
$$;

create or replace function public.create_canvas_group_for_project(
  target_workspace_id uuid,
  target_project_id text,
  target_title text,
  target_parent_group_id uuid default null
)
returns table (id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  next_sort_order bigint;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'workspace access denied';
  end if;
  perform private.assert_canvas_project_id_format(target_project_id);
  perform public.assert_canvas_title(target_title);

  if target_parent_group_id is not null and not exists (
    select 1
    from public.canvas_groups as group_row
    where group_row.id = target_parent_group_id
      and group_row.workspace_id = target_workspace_id
      and group_row.project_id = target_project_id
      and group_row.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'Parent Canvas group is unavailable in project';
  end if;

  select coalesce(max(group_row.sort_order) + 1, 0)
    into next_sort_order
    from public.canvas_groups as group_row
   where group_row.workspace_id = target_workspace_id
     and group_row.project_id = target_project_id
     and group_row.parent_group_id is not distinct from target_parent_group_id
     and group_row.deleted_at is null;

  return query
  insert into public.canvas_groups (
    workspace_id,
    project_id,
    parent_group_id,
    title,
    sort_order,
    created_by
  )
  values (
    target_workspace_id,
    target_project_id,
    target_parent_group_id,
    target_title,
    next_sort_order,
    (select auth.uid())
  )
  returning canvas_groups.id;
end;
$$;

revoke all on function public.create_canvas_for_project(uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.create_canvas_group_for_project(uuid, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.create_canvas_for_project(uuid, text, text, uuid)
  to authenticated;
grant execute on function public.create_canvas_group_for_project(uuid, text, text, uuid)
  to authenticated;
