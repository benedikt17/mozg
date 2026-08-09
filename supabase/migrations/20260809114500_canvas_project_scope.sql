-- Stage 3.3 correction: Canvas is project-scoped inside the Desktop workspace.
--
-- Product projects are currently authoritative in workspace_snapshots (Desktop
-- Snapshot V3), not in public.projects. Therefore Canvas stores the stable
-- snapshot project id as text and validates it against the workspace snapshot.
-- Existing Canvas rows are conservatively backfilled to the first project in
-- their workspace; environment-specific legacy corrections can be performed
-- explicitly after this backwards-compatible schema migration.

alter table public.canvas_groups
  add column if not exists project_id text;

alter table public.canvases
  add column if not exists project_id text;

create or replace function private.assert_canvas_project(
  target_workspace_id uuid,
  target_project_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if target_project_id is null
     or btrim(target_project_id) = ''
     or char_length(target_project_id) > 256
     or target_project_id ~ '[[:cntrl:]]'
     or not exists (
       select 1
       from public.workspace_snapshots as snapshot_row
       cross join lateral jsonb_array_elements(snapshot_row.snapshot -> 'projects') as project(value)
       where snapshot_row.workspace_id = target_workspace_id
         and project.value ->> 'id' = target_project_id
     ) then
    raise exception using errcode = '22023', message = 'Canvas project is unavailable';
  end if;
end;
$$;

revoke all on function private.assert_canvas_project(uuid, text)
  from public, anon, authenticated;

-- Backfill legacy groups first so grouped Canvases can inherit the same scope.
update public.canvas_groups as group_row
set project_id = (
  select project.value ->> 'id'
  from public.workspace_snapshots as snapshot_row
  cross join lateral jsonb_array_elements(snapshot_row.snapshot -> 'projects')
    with ordinality as project(value, position)
  where snapshot_row.workspace_id = group_row.workspace_id
  order by project.position
  limit 1
)
where group_row.project_id is null;

update public.canvases as canvas
set project_id = coalesce(
  (
    select group_row.project_id
    from public.canvas_groups as group_row
    where group_row.workspace_id = canvas.workspace_id
      and group_row.id = canvas.group_id
  ),
  (
    select project.value ->> 'id'
    from public.workspace_snapshots as snapshot_row
    cross join lateral jsonb_array_elements(snapshot_row.snapshot -> 'projects')
      with ordinality as project(value, position)
    where snapshot_row.workspace_id = canvas.workspace_id
    order by project.position
    limit 1
  )
)
where canvas.project_id is null;

do $$
begin
  if exists (select 1 from public.canvas_groups where project_id is null)
     or exists (select 1 from public.canvases where project_id is null) then
    raise exception 'Cannot project-scope existing Canvas rows without a Desktop project';
  end if;
end;
$$;

alter table public.canvas_groups
  alter column project_id set not null;

alter table public.canvases
  alter column project_id set not null;

alter table public.canvas_groups
  add constraint canvas_groups_project_id_check
  check (
    btrim(project_id) <> ''
    and char_length(project_id) <= 256
    and project_id !~ '[[:cntrl:]]'
  );

alter table public.canvases
  add constraint canvases_project_id_check
  check (
    btrim(project_id) <> ''
    and char_length(project_id) <= 256
    and project_id !~ '[[:cntrl:]]'
  );

alter table public.canvas_groups
  add constraint canvas_groups_workspace_project_id_key
  unique (workspace_id, project_id, id);

alter table public.canvases
  add constraint canvases_workspace_project_id_key
  unique (workspace_id, project_id, id);

alter table public.canvas_groups
  add constraint canvas_groups_parent_workspace_project_fkey
  foreign key (workspace_id, project_id, parent_group_id)
  references public.canvas_groups (workspace_id, project_id, id);

alter table public.canvases
  add constraint canvases_group_workspace_project_fkey
  foreign key (workspace_id, project_id, group_id)
  references public.canvas_groups (workspace_id, project_id, id);

create index canvas_groups_workspace_project_parent_sort_idx
  on public.canvas_groups (workspace_id, project_id, parent_group_id, sort_order)
  where deleted_at is null;

create index canvases_workspace_project_updated_idx
  on public.canvases (workspace_id, project_id, updated_at desc, id)
  where deleted_at is null;

-- Preserve compatibility for clients that still call the old create RPCs:
-- nullable project_id inserts are assigned to the parent group's project when
-- possible, otherwise to the first Desktop project in the workspace.
create or replace function private.assign_canvas_group_project()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.project_id is null and new.parent_group_id is not null then
    select group_row.project_id
      into new.project_id
      from public.canvas_groups as group_row
     where group_row.workspace_id = new.workspace_id
       and group_row.id = new.parent_group_id
       and group_row.deleted_at is null;
  end if;
  if new.project_id is null then
    select project.value ->> 'id'
      into new.project_id
      from public.workspace_snapshots as snapshot_row
      cross join lateral jsonb_array_elements(snapshot_row.snapshot -> 'projects')
        with ordinality as project(value, position)
     where snapshot_row.workspace_id = new.workspace_id
     order by project.position
     limit 1;
  end if;
  perform private.assert_canvas_project(new.workspace_id, new.project_id);
  return new;
end;
$$;

create or replace function private.assign_canvas_project()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.project_id is null and new.group_id is not null then
    select group_row.project_id
      into new.project_id
      from public.canvas_groups as group_row
     where group_row.workspace_id = new.workspace_id
       and group_row.id = new.group_id
       and group_row.deleted_at is null;
  end if;
  if new.project_id is null then
    select project.value ->> 'id'
      into new.project_id
      from public.workspace_snapshots as snapshot_row
      cross join lateral jsonb_array_elements(snapshot_row.snapshot -> 'projects')
        with ordinality as project(value, position)
     where snapshot_row.workspace_id = new.workspace_id
     order by project.position
     limit 1;
  end if;
  perform private.assert_canvas_project(new.workspace_id, new.project_id);
  return new;
end;
$$;

revoke all on function private.assign_canvas_group_project()
  from public, anon, authenticated;
revoke all on function private.assign_canvas_project()
  from public, anon, authenticated;

drop trigger if exists canvas_groups_assign_project on public.canvas_groups;
create trigger canvas_groups_assign_project
before insert or update of workspace_id, project_id, parent_group_id
on public.canvas_groups
for each row execute function private.assign_canvas_group_project();

drop trigger if exists canvases_assign_project on public.canvases;
create trigger canvases_assign_project
before insert or update of workspace_id, project_id, group_id
on public.canvases
for each row execute function private.assign_canvas_project();

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
  perform private.assert_canvas_project(target_workspace_id, target_project_id);
  perform public.assert_canvas_title(target_title);

  if target_group_id is not null and not exists (
    select 1
    from public.canvas_groups as group_row
    where group_row.id = target_group_id
      and group_row.workspace_id = target_workspace_id
      and group_row.project_id = target_project_id
      and group_row.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'Canvas group is unavailable';
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
  perform private.assert_canvas_project(target_workspace_id, target_project_id);
  perform public.assert_canvas_title(target_title);

  if target_parent_group_id is not null and not exists (
    select 1
    from public.canvas_groups as group_row
    where group_row.id = target_parent_group_id
      and group_row.workspace_id = target_workspace_id
      and group_row.project_id = target_project_id
      and group_row.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'Parent Canvas group is unavailable';
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