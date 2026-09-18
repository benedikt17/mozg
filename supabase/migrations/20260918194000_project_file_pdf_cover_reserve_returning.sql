-- Return relation rows directly. Returning a composite PL/pgSQL variable as a
-- single column is not compatible with this RPC's SETOF file_variants contract.

create or replace function public.reserve_project_file_pdf_cover(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid,
  target_byte_size bigint,
  target_pixel_width integer,
  target_pixel_height integer
)
returns setof public.file_variants
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_storage_path text;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not private.is_workspace_project_id(target_workspace_id, target_project_id) then
    raise exception using errcode = '42501', message = 'Project file PDF cover access denied';
  end if;

  if not exists (
    select 1 from public.project_files as file_row
    where file_row.workspace_id = target_workspace_id
      and file_row.project_id = target_project_id
      and file_row.id = target_file_id
      and file_row.mime_type = 'application/pdf'
      and file_row.ready_at is not null
      and file_row.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'Project file PDF source is unavailable';
  end if;

  if target_byte_size is null or target_byte_size <= 0 or target_byte_size > 20971520
     or target_pixel_width is null or target_pixel_height is null
     or target_pixel_width <= 0 or target_pixel_height <= 0
     or target_pixel_width > 1024 or target_pixel_height > 1024 then
    raise exception using errcode = '22023', message = 'Project file PDF cover metadata is invalid';
  end if;

  target_storage_path := private.project_file_pdf_cover_storage_path(
    target_workspace_id,
    target_file_id
  );

  insert into public.file_variants (
    workspace_id, project_id, file_id, kind, storage_path, mime_type,
    byte_size, pixel_width, pixel_height, target_max_edge, processing_error
  ) values (
    target_workspace_id, target_project_id, target_file_id, 'pdf-page-1', target_storage_path,
    'image/webp', target_byte_size, target_pixel_width, target_pixel_height,
    greatest(target_pixel_width, target_pixel_height), null
  ) on conflict (workspace_id, project_id, file_id, kind) do nothing;

  return query
  update public.file_variants
     set byte_size = target_byte_size,
         pixel_width = target_pixel_width,
         pixel_height = target_pixel_height,
         target_max_edge = greatest(target_pixel_width, target_pixel_height),
         processing_error = null
   where workspace_id = target_workspace_id
     and project_id = target_project_id
     and file_id = target_file_id
     and kind = 'pdf-page-1'
     and ready_at is null
  returning *;

  if found then return; end if;

  return query
  select *
  from public.file_variants
  where workspace_id = target_workspace_id
    and project_id = target_project_id
    and file_id = target_file_id
    and kind = 'pdf-page-1';
end;
$$;
