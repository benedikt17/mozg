-- Repeated selection of the same binary must reuse its existing Project File.
-- The client sends SHA-256 content identity; this RPC executes the lookup in
-- the same security boundary as the following reservation.

create index if not exists project_files_ready_content_lookup_idx
  on public.project_files (workspace_id, project_id, checksum)
  where ready_at is not null and deleted_at is null and checksum is not null;

create or replace function public.reserve_project_file(
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
declare
  existing_file public.project_files%rowtype;
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

  if target_checksum is not null then
    select file_row.* into existing_file
      from public.project_files as file_row
     where file_row.workspace_id = target_workspace_id
       and file_row.project_id = target_project_id
       and file_row.checksum = target_checksum
       and file_row.ready_at is not null
       and file_row.deleted_at is null
     order by file_row.created_at asc
     limit 1;
    if found then
      return next existing_file;
      return;
    end if;
  end if;

  return query
  insert into public.project_files (
    id, workspace_id, project_id, folder_id, name, original_name,
    storage_key, mime_type, byte_size, checksum, width, height, created_by
  ) values (
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
  ) returning project_files.*;
end;
$$;

revoke all on function public.reserve_project_file(
  uuid, text, uuid, text, text, text, bigint, uuid, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.reserve_project_file(
  uuid, text, uuid, text, text, text, bigint, uuid, integer, integer, text
) to authenticated;
