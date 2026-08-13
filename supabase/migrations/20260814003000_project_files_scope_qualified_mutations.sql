-- Stage A1 hardening: every Files mutation carries the caller's explicit
-- workspace + Project scope. This prevents stale UI state from mutating a
-- resource in another Project merely because its UUID is known.

revoke all on function public.rename_project_folder(uuid, text)
  from public, anon, authenticated;
revoke all on function public.move_project_folder(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_project_file(uuid)
  from public, anon, authenticated;
revoke all on function public.rename_project_file(uuid, text)
  from public, anon, authenticated;
revoke all on function public.move_project_file(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_project_file(uuid)
  from public, anon, authenticated;
revoke all on function public.restore_project_file(uuid)
  from public, anon, authenticated;

drop function public.rename_project_folder(uuid, text);
drop function public.move_project_folder(uuid, uuid);
drop function public.finalize_project_file(uuid);
drop function public.rename_project_file(uuid, text);
drop function public.move_project_file(uuid, uuid);
drop function public.delete_project_file(uuid);
drop function public.restore_project_file(uuid);

create function public.rename_project_folder(
  target_workspace_id uuid,
  target_project_id text,
  target_folder_id uuid,
  target_name text
)
returns setof public.project_folders
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not exists (
       select 1
       from public.project_folders as folder_row
       where folder_row.id = target_folder_id
         and folder_row.workspace_id = target_workspace_id
         and folder_row.project_id = target_project_id
         and folder_row.deleted_at is null
     ) then
    raise exception using errcode = '42501', message = 'Project folder access denied';
  end if;

  perform private.assert_project_file_name(target_name);

  return query
  update public.project_folders as folder_row
     set name = target_name
   where folder_row.id = target_folder_id
     and folder_row.workspace_id = target_workspace_id
     and folder_row.project_id = target_project_id
     and folder_row.deleted_at is null
  returning folder_row.*;
end;
$$;

create function public.move_project_folder(
  target_workspace_id uuid,
  target_project_id text,
  target_folder_id uuid,
  target_parent_folder_id uuid default null
)
returns setof public.project_folders
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  next_sort_order bigint;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not exists (
       select 1
       from public.project_folders as folder_row
       where folder_row.id = target_folder_id
         and folder_row.workspace_id = target_workspace_id
         and folder_row.project_id = target_project_id
         and folder_row.deleted_at is null
     ) then
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
     and folder_row.workspace_id = target_workspace_id
     and folder_row.project_id = target_project_id
     and folder_row.deleted_at is null
  returning folder_row.*;
end;
$$;

create function public.finalize_project_file(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid
)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public, private, storage
as $$
declare
  target_storage_key text;
  target_mime_type text;
  target_byte_size bigint;
  target_ready_at timestamptz;
  object_mime_type text;
  object_byte_size bigint;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  select file_row.storage_key,
         file_row.mime_type,
         file_row.byte_size,
         file_row.ready_at
    into target_storage_key,
         target_mime_type,
         target_byte_size,
         target_ready_at
    from public.project_files as file_row
   where file_row.id = target_file_id
     and file_row.workspace_id = target_workspace_id
     and file_row.project_id = target_project_id
     and file_row.deleted_at is null;

  if target_storage_key is null then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  if target_ready_at is null then
    select lower(object_row.metadata ->> 'mimetype'),
           nullif(object_row.metadata ->> 'size', '')::bigint
      into object_mime_type, object_byte_size
      from storage.objects as object_row
     where object_row.bucket_id = 'project-files'
       and object_row.name = target_storage_key;

    if object_mime_type is null or object_byte_size is null then
      raise exception using errcode = '22023', message = 'Project file object is missing';
    end if;

    if object_mime_type <> target_mime_type or object_byte_size <> target_byte_size then
      raise exception using errcode = '22023', message = 'Project file object metadata does not match reservation';
    end if;
  end if;

  return query
  update public.project_files as file_row
     set ready_at = coalesce(file_row.ready_at, now())
   where file_row.id = target_file_id
     and file_row.workspace_id = target_workspace_id
     and file_row.project_id = target_project_id
     and file_row.deleted_at is null
  returning file_row.*;
end;
$$;

create function public.rename_project_file(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid,
  target_name text
)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not exists (
       select 1
       from public.project_files as file_row
       where file_row.id = target_file_id
         and file_row.workspace_id = target_workspace_id
         and file_row.project_id = target_project_id
         and file_row.deleted_at is null
     ) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  perform private.assert_project_file_name(target_name);

  return query
  update public.project_files as file_row
     set name = target_name
   where file_row.id = target_file_id
     and file_row.workspace_id = target_workspace_id
     and file_row.project_id = target_project_id
     and file_row.deleted_at is null
  returning file_row.*;
end;
$$;

create function public.move_project_file(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid,
  target_folder_id uuid default null
)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not exists (
       select 1
       from public.project_files as file_row
       where file_row.id = target_file_id
         and file_row.workspace_id = target_workspace_id
         and file_row.project_id = target_project_id
         and file_row.deleted_at is null
     ) then
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
     and file_row.workspace_id = target_workspace_id
     and file_row.project_id = target_project_id
     and file_row.deleted_at is null
  returning file_row.*;
end;
$$;

create function public.delete_project_file(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid
)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not exists (
       select 1
       from public.project_files as file_row
       where file_row.id = target_file_id
         and file_row.workspace_id = target_workspace_id
         and file_row.project_id = target_project_id
     ) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  return query
  update public.project_files as file_row
     set deleted_at = coalesce(file_row.deleted_at, now())
   where file_row.id = target_file_id
     and file_row.workspace_id = target_workspace_id
     and file_row.project_id = target_project_id
  returning file_row.*;
end;
$$;

create function public.restore_project_file(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid
)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_folder_id uuid;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  select file_row.folder_id
    into target_folder_id
    from public.project_files as file_row
   where file_row.id = target_file_id
     and file_row.workspace_id = target_workspace_id
     and file_row.project_id = target_project_id;

  if not found then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  perform private.assert_project_folder_target(
    target_workspace_id,
    target_project_id,
    target_folder_id
  );

  return query
  update public.project_files as file_row
     set deleted_at = null
   where file_row.id = target_file_id
     and file_row.workspace_id = target_workspace_id
     and file_row.project_id = target_project_id
  returning file_row.*;
end;
$$;

-- Deleted folders are implementation metadata for editors, not normal viewer
-- navigation. Folder archive/restore mutations are deliberately not exposed in
-- Stage A1 until product semantics for non-empty folders are defined.
drop policy project_folders_select_member on public.project_folders;
create policy project_folders_select_member
on public.project_folders
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    deleted_at is null
    or public.has_workspace_role(workspace_id, array['owner', 'editor'])
  )
);

revoke all on function public.rename_project_folder(uuid, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.move_project_folder(uuid, text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_project_file(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.rename_project_file(uuid, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.move_project_file(uuid, text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_project_file(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.restore_project_file(uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function public.rename_project_folder(uuid, text, uuid, text)
  to authenticated;
grant execute on function public.move_project_folder(uuid, text, uuid, uuid)
  to authenticated;
grant execute on function public.finalize_project_file(uuid, text, uuid)
  to authenticated;
grant execute on function public.rename_project_file(uuid, text, uuid, text)
  to authenticated;
grant execute on function public.move_project_file(uuid, text, uuid, uuid)
  to authenticated;
grant execute on function public.delete_project_file(uuid, text, uuid)
  to authenticated;
grant execute on function public.restore_project_file(uuid, text, uuid)
  to authenticated;
