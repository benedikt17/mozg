-- Files B3: a PDF first-page cover is a private, disposable WebP derivative.
-- It deliberately reuses the canonical file_variants table and stable Storage
-- prefix; original PDFs, file ids, and Files↔Canvas references are unchanged.

alter table public.file_variants
  add column if not exists processing_error text;

alter table public.file_variants
  add constraint file_variants_processing_error_check
  check (
    processing_error is null
    or (ready_at is null and length(btrim(processing_error)) between 1 and 96)
  );

drop policy if exists file_variants_select_member on public.file_variants;

create policy file_variants_select_member
on public.file_variants
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.project_files as file_row
    where file_row.workspace_id = file_variants.workspace_id
      and file_row.project_id = file_variants.project_id
      and file_row.id = file_variants.file_id
      and file_row.ready_at is not null
      and file_row.deleted_at is null
  )
  and (
    ready_at is not null
    or (
      kind = 'pdf-page-1'
      and public.has_workspace_role(workspace_id, array['owner', 'editor'])
    )
  )
);

create function private.project_file_pdf_cover_storage_path(
  target_workspace_id uuid,
  target_file_id uuid
)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select target_workspace_id::text || '/' || target_file_id::text || '/variants/pdf-page-1.webp';
$$;

create function public.reserve_project_file_pdf_cover(
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
  existing_row public.file_variants%rowtype;
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

  target_storage_path := private.project_file_pdf_cover_storage_path(target_workspace_id, target_file_id);

  insert into public.file_variants (
    workspace_id, project_id, file_id, kind, storage_path, mime_type,
    byte_size, pixel_width, pixel_height, target_max_edge, processing_error
  ) values (
    target_workspace_id, target_project_id, target_file_id, 'pdf-page-1', target_storage_path,
    'image/webp', target_byte_size, target_pixel_width, target_pixel_height,
    greatest(target_pixel_width, target_pixel_height), null
  ) on conflict (workspace_id, project_id, file_id, kind) do nothing;

  select * into existing_row from public.file_variants
   where workspace_id = target_workspace_id and project_id = target_project_id
     and file_id = target_file_id and kind = 'pdf-page-1';

  if existing_row.ready_at is not null then
    return query select existing_row;
    return;
  end if;

  update public.file_variants
     set byte_size = target_byte_size,
         pixel_width = target_pixel_width,
         pixel_height = target_pixel_height,
         target_max_edge = greatest(target_pixel_width, target_pixel_height),
         processing_error = null
   where workspace_id = target_workspace_id and project_id = target_project_id
     and file_id = target_file_id and kind = 'pdf-page-1'
  returning * into existing_row;

  return query select existing_row;
end;
$$;

create function public.finalize_project_file_pdf_cover(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid
)
returns setof public.file_variants
language plpgsql
security definer
set search_path = pg_catalog, public, private, storage
as $$
declare
  cover_row public.file_variants%rowtype;
  object_mime_type text;
  object_byte_size bigint;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not private.is_workspace_project_id(target_workspace_id, target_project_id) then
    raise exception using errcode = '42501', message = 'Project file PDF cover access denied';
  end if;
  select variant_row.* into cover_row from public.file_variants as variant_row
   join public.project_files as file_row on file_row.workspace_id = variant_row.workspace_id
    and file_row.project_id = variant_row.project_id and file_row.id = variant_row.file_id
   where variant_row.workspace_id = target_workspace_id and variant_row.project_id = target_project_id
     and variant_row.file_id = target_file_id and variant_row.kind = 'pdf-page-1'
     and file_row.mime_type = 'application/pdf' and file_row.ready_at is not null and file_row.deleted_at is null;
  if cover_row.storage_path is null then raise exception using errcode = '22023', message = 'Project file PDF cover reservation is unavailable'; end if;
  select lower(metadata ->> 'mimetype'), nullif(metadata ->> 'size', '')::bigint
    into object_mime_type, object_byte_size from storage.objects
   where bucket_id = 'project-files' and name = cover_row.storage_path;
  if object_mime_type <> 'image/webp' or object_byte_size <> cover_row.byte_size then
    raise exception using errcode = '22023', message = 'Project file PDF cover object metadata does not match reservation';
  end if;
  return query update public.file_variants set ready_at = coalesce(ready_at, now()), processing_error = null
   where workspace_id = target_workspace_id and project_id = target_project_id and file_id = target_file_id and kind = 'pdf-page-1'
  returning *;
end;
$$;

create function public.fail_project_file_pdf_cover(
  target_workspace_id uuid, target_project_id text, target_file_id uuid, target_error text
)
returns void language plpgsql security definer set search_path = pg_catalog, public, private
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not private.is_workspace_project_id(target_workspace_id, target_project_id) then
    raise exception using errcode = '42501', message = 'Project file PDF cover access denied';
  end if;
  update public.file_variants set processing_error = left(coalesce(nullif(btrim(target_error), ''), 'render-failed'), 96)
   where workspace_id = target_workspace_id and project_id = target_project_id and file_id = target_file_id
     and kind = 'pdf-page-1' and ready_at is null;
end;
$$;

revoke all on function private.project_file_pdf_cover_storage_path(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reserve_project_file_pdf_cover(uuid, text, uuid, bigint, integer, integer) from public, anon, authenticated;
revoke all on function public.finalize_project_file_pdf_cover(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.fail_project_file_pdf_cover(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_project_file_pdf_cover(uuid, text, uuid, bigint, integer, integer) to authenticated;
grant execute on function public.finalize_project_file_pdf_cover(uuid, text, uuid) to authenticated;
grant execute on function public.fail_project_file_pdf_cover(uuid, text, uuid, text) to authenticated;
