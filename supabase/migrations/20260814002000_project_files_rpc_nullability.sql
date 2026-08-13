-- Stage A1 follow-up: make root-folder operations natural for generated clients.
-- PostgreSQL nullable arguments are not represented as `T | null` by generated
-- Supabase TypeScript types. Optional trailing arguments with DEFAULT NULL let
-- callers omit the argument when targeting the Project root without casts.

-- Replace the first reserve signature with one where all mandatory arguments
-- precede optional location/image metadata arguments.
revoke all on function public.reserve_project_file(
  uuid, text, uuid, uuid, text, text, text, bigint, integer, integer, text
) from public, anon, authenticated;

drop function public.reserve_project_file(
  uuid, text, uuid, uuid, text, text, text, bigint, integer, integer, text
);

create function public.reserve_project_file(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid,
  target_name text,
  target_original_name text,
  target_mime_type text,
  target_byte_size bigint,
  target_folder_id uuid default null,
  target_width integer default null,
  target_height integer default null,
  target_checksum text default null
)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not private.is_workspace_project_id(target_workspace_id, target_project_id) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  perform private.assert_project_file_name(target_name);
  perform private.assert_project_file_name(target_original_name);
  perform private.assert_project_file_metadata(
    target_mime_type,
    target_byte_size,
    target_width,
    target_height,
    target_checksum
  );
  perform private.assert_project_folder_target(
    target_workspace_id,
    target_project_id,
    target_folder_id
  );

  return query
  insert into public.project_files (
    id,
    workspace_id,
    project_id,
    folder_id,
    name,
    original_name,
    storage_key,
    mime_type,
    byte_size,
    checksum,
    width,
    height,
    created_by
  )
  values (
    target_file_id,
    target_workspace_id,
    target_project_id,
    target_folder_id,
    target_name,
    target_original_name,
    private.project_file_storage_key(target_workspace_id, target_file_id),
    target_mime_type,
    target_byte_size,
    target_checksum,
    target_width,
    target_height,
    (select auth.uid())
  )
  returning project_files.*;
end;
$$;

revoke all on function public.reserve_project_file(
  uuid, text, uuid, text, text, text, bigint, uuid, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.reserve_project_file(
  uuid, text, uuid, text, text, text, bigint, uuid, integer, integer, text
) to authenticated;

create or replace function public.move_project_file(
  target_file_id uuid,
  target_folder_id uuid default null
)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_workspace_id uuid;
  target_project_id text;
begin
  select file_row.workspace_id, file_row.project_id
    into target_workspace_id, target_project_id
    from public.project_files as file_row
   where file_row.id = target_file_id;

  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  perform private.assert_project_folder_target(
    target_workspace_id,
    target_project_id,
    target_folder_id
  );

  return query
  update public.project_files as file_row
     set folder_id = target_folder_id
   where file_row.id = target_file_id
  returning file_row.*;
end;
$$;

create or replace function public.move_project_folder(
  target_folder_id uuid,
  target_parent_folder_id uuid default null
)
returns setof public.project_folders
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_workspace_id uuid;
  target_project_id text;
  next_sort_order bigint;
begin
  select folder_row.workspace_id, folder_row.project_id
    into target_workspace_id, target_project_id
    from public.project_folders as folder_row
   where folder_row.id = target_folder_id
     and folder_row.deleted_at is null;

  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project folder access denied';
  end if;

  perform private.assert_project_folder_target(
    target_workspace_id,
    target_project_id,
    target_parent_folder_id
  );

  if target_parent_folder_id = target_folder_id or exists (
    with recursive descendants(id) as (
      select folder_row.id
      from public.project_folders as folder_row
      where folder_row.id = target_folder_id
        and folder_row.workspace_id = target_workspace_id
        and folder_row.project_id = target_project_id
        and folder_row.deleted_at is null
      union all
      select child.id
      from public.project_folders as child
      join descendants as parent on parent.id = child.parent_folder_id
      where child.workspace_id = target_workspace_id
        and child.project_id = target_project_id
        and child.deleted_at is null
    )
    select 1 from descendants where id = target_parent_folder_id
  ) then
    raise exception using errcode = '22023', message = 'Project folder cycle is not allowed';
  end if;

  select coalesce(max(folder_row.sort_order) + 1, 0)
    into next_sort_order
    from public.project_folders as folder_row
   where folder_row.workspace_id = target_workspace_id
     and folder_row.project_id = target_project_id
     and folder_row.parent_folder_id is not distinct from target_parent_folder_id
     and folder_row.deleted_at is null
     and folder_row.id <> target_folder_id;

  return query
  update public.project_folders as folder_row
     set parent_folder_id = target_parent_folder_id,
         sort_order = next_sort_order
   where folder_row.id = target_folder_id
     and folder_row.deleted_at is null
  returning folder_row.*;
end;
$$;
