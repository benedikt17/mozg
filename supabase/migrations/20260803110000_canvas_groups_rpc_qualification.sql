-- The first Canvas groups migration was applied to local databases before the
-- overloaded create_canvas signature and PL/pgSQL column references were
-- exercised by the full RLS suite. Keep this forward-only correction separate
-- so existing Canvas data is not rewritten or reset.

drop function if exists public.create_canvas(uuid, text, uuid);
drop function if exists public.create_canvas_group(uuid, text, uuid);

create function public.create_canvas(
  target_workspace_id uuid,
  target_title text,
  target_group_id uuid
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
  perform public.assert_canvas_title(target_title);
  if target_group_id is not null and not exists (
    select 1
    from public.canvas_groups as group_row
    where group_row.id = target_group_id
      and group_row.workspace_id = target_workspace_id
      and group_row.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'Canvas group is unavailable';
  end if;
  select coalesce(max(canvas.sort_order) + 1, 0)
    into next_sort_order
    from public.canvases as canvas
   where canvas.workspace_id = target_workspace_id
     and canvas.group_id is not distinct from target_group_id
     and canvas.deleted_at is null;
  return query
  insert into public.canvases (
    workspace_id, group_id, sort_order, title, schema_version, document, revision, created_by
  )
  values (
    target_workspace_id,
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

create or replace function public.create_canvas_group(
  target_workspace_id uuid,
  target_title text,
  target_parent_group_id uuid
)
returns setof public.canvas_groups
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
  perform public.assert_canvas_title(target_title);
  if target_parent_group_id is not null and not exists (
    select 1
    from public.canvas_groups as group_row
    where group_row.id = target_parent_group_id
      and group_row.workspace_id = target_workspace_id
      and group_row.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'Parent Canvas group is unavailable';
  end if;
  select coalesce(max(group_row.sort_order) + 1, 0)
    into next_sort_order
    from public.canvas_groups as group_row
   where group_row.workspace_id = target_workspace_id
     and group_row.parent_group_id is not distinct from target_parent_group_id
     and group_row.deleted_at is null;
  return query
  insert into public.canvas_groups (
    workspace_id, parent_group_id, title, sort_order, created_by
  )
  values (
    target_workspace_id, target_parent_group_id, target_title, next_sort_order, (select auth.uid())
  )
  returning canvas_groups.*;
end;
$$;

create or replace function public.rename_canvas_group(
  target_group_id uuid,
  target_title text
)
returns setof public.canvas_groups
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_workspace_id uuid;
begin
  perform public.assert_canvas_title(target_title);
  select group_row.workspace_id
    into target_workspace_id
    from public.canvas_groups as group_row
   where group_row.id = target_group_id
     and group_row.deleted_at is null;
  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas group access denied';
  end if;
  return query
  update public.canvas_groups as group_row
     set title = target_title
   where group_row.id = target_group_id
     and group_row.deleted_at is null
  returning group_row.*;
end;
$$;

create or replace function public.delete_canvas_group(target_group_id uuid)
returns table (id uuid, workspace_id uuid, deleted boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_workspace_id uuid;
  current_parent_group_id uuid;
  current_deleted_at timestamptz;
begin
  select group_row.workspace_id, group_row.parent_group_id, group_row.deleted_at
    into current_workspace_id, current_parent_group_id, current_deleted_at
    from public.canvas_groups as group_row
   where group_row.id = target_group_id;
  if current_workspace_id is null
     or not public.has_workspace_role(current_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas group access denied';
  end if;
  if current_deleted_at is not null then
    return query select target_group_id, current_workspace_id, false;
    return;
  end if;
  update public.canvases as canvas
     set group_id = current_parent_group_id
   where canvas.workspace_id = current_workspace_id
     and canvas.group_id = target_group_id
     and canvas.deleted_at is null;
  update public.canvas_groups as child_group
     set parent_group_id = current_parent_group_id
   where child_group.workspace_id = current_workspace_id
     and child_group.parent_group_id = target_group_id
     and child_group.deleted_at is null;
  update public.canvas_groups as group_row
     set deleted_at = now()
   where group_row.id = target_group_id
     and group_row.deleted_at is null;
  return query select target_group_id, current_workspace_id, true;
end;
$$;

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
  next_sort_order bigint;
begin
  select group_row.workspace_id
    into target_workspace_id
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
      and group_row.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'Parent Canvas group is unavailable';
  end if;
  if target_parent_group_id = target_group_id or exists (
    with recursive descendants(group_id) as (
      select group_row.id
        from public.canvas_groups as group_row
       where group_row.id = target_group_id
         and group_row.workspace_id = target_workspace_id
      union all
      select child.id
        from public.canvas_groups as child
        join descendants as parent on parent.group_id = child.parent_group_id
       where child.workspace_id = target_workspace_id
         and child.deleted_at is null
    )
    select 1 from descendants where descendants.group_id = target_parent_group_id
  ) then
    raise exception using errcode = '22023', message = 'Canvas group cycle is not allowed';
  end if;
  select coalesce(max(group_row.sort_order) + 1, 0)
    into next_sort_order
    from public.canvas_groups as group_row
   where group_row.workspace_id = target_workspace_id
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
  next_sort_order bigint;
begin
  select canvas.workspace_id
    into target_workspace_id
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
      and group_row.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'Canvas group is unavailable';
  end if;
  select coalesce(max(canvas.sort_order) + 1, 0)
    into next_sort_order
    from public.canvases as canvas
   where canvas.workspace_id = target_workspace_id
     and canvas.group_id is not distinct from target_group_id
     and canvas.deleted_at is null
     and canvas.id <> target_canvas_id;
  update public.canvases as canvas
     set group_id = target_group_id, sort_order = next_sort_order
   where canvas.id = target_canvas_id
     and canvas.deleted_at is null;
end;
$$;

revoke all on function public.create_canvas(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.create_canvas_group(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.rename_canvas_group(uuid, text) from public, anon, authenticated;
revoke all on function public.delete_canvas_group(uuid) from public, anon, authenticated;
revoke all on function public.move_canvas_group(uuid, uuid) from public, anon, authenticated;
revoke all on function public.move_canvas_to_group(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_canvas(uuid, text, uuid) to authenticated;
grant execute on function public.create_canvas_group(uuid, text, uuid) to authenticated;
grant execute on function public.rename_canvas_group(uuid, text) to authenticated;
grant execute on function public.delete_canvas_group(uuid) to authenticated;
grant execute on function public.move_canvas_group(uuid, uuid) to authenticated;
grant execute on function public.move_canvas_to_group(uuid, uuid) to authenticated;
