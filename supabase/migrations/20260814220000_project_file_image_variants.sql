-- Files B2: authenticated image derivatives for project_files.
-- Originals remain immutable and authoritative. Variants are disposable WebP caches.

create or replace function private.project_file_variant_storage_path(
  target_workspace_id uuid,
  target_file_id uuid,
  requested_max_edge integer
)
returns text
language plpgsql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
begin
  if requested_max_edge < 64 or requested_max_edge > 16384 then
    raise exception using errcode = '22023', message = 'Project file variant target edge is invalid';
  end if;
  return target_workspace_id::text || '/' || target_file_id::text || '/variants/edge-' || requested_max_edge::text || '.webp';
end;
$$;

create or replace function public.reserve_project_file_variant(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid,
  requested_max_edge integer,
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
  original_width integer;
  original_height integer;
  original_mime_type text;
  target_kind text;
  target_storage_path text;
  existing_row public.file_variants%rowtype;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not private.is_workspace_project_id(target_workspace_id, target_project_id) then
    raise exception using errcode = '42501', message = 'Project file variant access denied';
  end if;

  select file_row.width, file_row.height, file_row.mime_type
    into original_width, original_height, original_mime_type
    from public.project_files as file_row
   where file_row.workspace_id = target_workspace_id
     and file_row.project_id = target_project_id
     and file_row.id = target_file_id
     and file_row.ready_at is not null
     and file_row.deleted_at is null;

  if original_width is null
     or original_height is null
     or original_mime_type not like 'image/%' then
    raise exception using errcode = '22023', message = 'Project file image source is unavailable';
  end if;

  if requested_max_edge < 64
     or requested_max_edge > 16384
     or requested_max_edge >= greatest(original_width, original_height) then
    raise exception using errcode = '22023', message = 'Project file variant target edge is invalid';
  end if;

  if target_byte_size is null or target_byte_size <= 0 or target_byte_size > 20971520 then
    raise exception using errcode = '22023', message = 'Project file variant byte size is invalid';
  end if;

  if target_pixel_width is null
     or target_pixel_height is null
     or target_pixel_width <= 0
     or target_pixel_height <= 0
     or target_pixel_width > original_width
     or target_pixel_height > original_height
     or target_pixel_width > 16384
     or target_pixel_height > 16384
     or greatest(target_pixel_width, target_pixel_height) > requested_max_edge
     or abs(target_pixel_width::bigint * original_height::bigint - original_width::bigint * target_pixel_height::bigint) > original_height::bigint then
    raise exception using errcode = '22023', message = 'Project file variant dimensions are invalid';
  end if;

  target_kind := 'edge-' || requested_max_edge::text;
  target_storage_path := private.project_file_variant_storage_path(
    target_workspace_id,
    target_file_id,
    requested_max_edge
  );

  insert into public.file_variants (
    workspace_id,
    project_id,
    file_id,
    kind,
    storage_path,
    mime_type,
    byte_size,
    pixel_width,
    pixel_height,
    target_max_edge
  )
  values (
    target_workspace_id,
    target_project_id,
    target_file_id,
    target_kind,
    target_storage_path,
    'image/webp',
    target_byte_size,
    target_pixel_width,
    target_pixel_height,
    requested_max_edge
  )
  on conflict (workspace_id, project_id, file_id, kind) do nothing;

  select variant_row.*
    into existing_row
    from public.file_variants as variant_row
   where variant_row.workspace_id = target_workspace_id
     and variant_row.project_id = target_project_id
     and variant_row.file_id = target_file_id
     and variant_row.kind = target_kind;

  if existing_row.storage_path is distinct from target_storage_path
     or existing_row.mime_type is distinct from 'image/webp'
     or existing_row.byte_size is distinct from target_byte_size
     or existing_row.pixel_width is distinct from target_pixel_width
     or existing_row.pixel_height is distinct from target_pixel_height
     or existing_row.target_max_edge is distinct from requested_max_edge then
    raise exception using errcode = '23505', message = 'Project file variant identity already exists with different metadata';
  end if;

  return query
  select variant_row.*
    from public.file_variants as variant_row
   where variant_row.workspace_id = target_workspace_id
     and variant_row.project_id = target_project_id
     and variant_row.file_id = target_file_id
     and variant_row.kind = target_kind;
end;
$$;

create or replace function public.finalize_project_file_variant(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid,
  requested_max_edge integer
)
returns setof public.file_variants
language plpgsql
security definer
set search_path = pg_catalog, public, private, storage
as $$
declare
  target_kind text;
  target_storage_path text;
  target_byte_size bigint;
  target_ready_at timestamptz;
  object_mime_type text;
  object_byte_size bigint;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not private.is_workspace_project_id(target_workspace_id, target_project_id) then
    raise exception using errcode = '42501', message = 'Project file variant access denied';
  end if;

  if requested_max_edge < 64 or requested_max_edge > 16384 then
    raise exception using errcode = '22023', message = 'Project file variant target edge is invalid';
  end if;

  target_kind := 'edge-' || requested_max_edge::text;

  select variant_row.storage_path,
         variant_row.byte_size,
         variant_row.ready_at
    into target_storage_path,
         target_byte_size,
         target_ready_at
    from public.file_variants as variant_row
    join public.project_files as file_row
      on file_row.workspace_id = variant_row.workspace_id
     and file_row.project_id = variant_row.project_id
     and file_row.id = variant_row.file_id
   where variant_row.workspace_id = target_workspace_id
     and variant_row.project_id = target_project_id
     and variant_row.file_id = target_file_id
     and variant_row.kind = target_kind
     and file_row.ready_at is not null
     and file_row.deleted_at is null;

  if target_storage_path is null then
    raise exception using errcode = '22023', message = 'Project file variant reservation is unavailable';
  end if;

  if target_ready_at is null then
    select lower(object_row.metadata ->> 'mimetype'),
           nullif(object_row.metadata ->> 'size', '')::bigint
      into object_mime_type, object_byte_size
      from storage.objects as object_row
     where object_row.bucket_id = 'project-files'
       and object_row.name = target_storage_path;

    if object_mime_type is null or object_byte_size is null then
      raise exception using errcode = '22023', message = 'Project file variant object is missing';
    end if;

    if object_mime_type <> 'image/webp' or object_byte_size <> target_byte_size then
      raise exception using errcode = '22023', message = 'Project file variant object metadata does not match reservation';
    end if;
  end if;

  return query
  update public.file_variants as variant_row
     set ready_at = coalesce(variant_row.ready_at, now())
   where variant_row.workspace_id = target_workspace_id
     and variant_row.project_id = target_project_id
     and variant_row.file_id = target_file_id
     and variant_row.kind = target_kind
  returning variant_row.*;
end;
$$;

create or replace function public.delete_project_file_variant(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid,
  requested_max_edge integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_kind text;
  deleted_count integer;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not private.is_workspace_project_id(target_workspace_id, target_project_id) then
    raise exception using errcode = '42501', message = 'Project file variant access denied';
  end if;

  if requested_max_edge < 64 or requested_max_edge > 16384 then
    raise exception using errcode = '22023', message = 'Project file variant target edge is invalid';
  end if;

  target_kind := 'edge-' || requested_max_edge::text;

  delete from public.file_variants as variant_row
   using public.project_files as file_row
   where variant_row.workspace_id = target_workspace_id
     and variant_row.project_id = target_project_id
     and variant_row.file_id = target_file_id
     and variant_row.kind = target_kind
     and file_row.workspace_id = variant_row.workspace_id
     and file_row.project_id = variant_row.project_id
     and file_row.id = variant_row.file_id;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

create policy project_file_variants_storage_select_editor
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-files'
  and exists (
    select 1
    from public.file_variants as variant_row
    join public.project_files as file_row
      on file_row.workspace_id = variant_row.workspace_id
     and file_row.project_id = variant_row.project_id
     and file_row.id = variant_row.file_id
    where variant_row.storage_path = storage.objects.name
      and file_row.ready_at is not null
      and file_row.deleted_at is null
      and public.has_workspace_role(file_row.workspace_id, array['owner', 'editor'])
  )
);

create policy project_file_variants_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-files'
  and exists (
    select 1
    from public.file_variants as variant_row
    join public.project_files as file_row
      on file_row.workspace_id = variant_row.workspace_id
     and file_row.project_id = variant_row.project_id
     and file_row.id = variant_row.file_id
    where variant_row.storage_path = storage.objects.name
      and variant_row.ready_at is null
      and file_row.ready_at is not null
      and file_row.deleted_at is null
      and public.has_workspace_role(file_row.workspace_id, array['owner', 'editor'])
  )
);

create policy project_file_variants_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-files'
  and exists (
    select 1
    from public.file_variants as variant_row
    join public.project_files as file_row
      on file_row.workspace_id = variant_row.workspace_id
     and file_row.project_id = variant_row.project_id
     and file_row.id = variant_row.file_id
    where variant_row.storage_path = storage.objects.name
      and file_row.ready_at is not null
      and file_row.deleted_at is null
      and public.has_workspace_role(file_row.workspace_id, array['owner', 'editor'])
  )
);

revoke all on function private.project_file_variant_storage_path(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.reserve_project_file_variant(uuid, text, uuid, integer, bigint, integer, integer) from public, anon, authenticated;
revoke all on function public.finalize_project_file_variant(uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.delete_project_file_variant(uuid, text, uuid, integer) from public, anon, authenticated;

grant execute on function public.reserve_project_file_variant(uuid, text, uuid, integer, bigint, integer, integer) to authenticated;
grant execute on function public.finalize_project_file_variant(uuid, text, uuid, integer) to authenticated;
grant execute on function public.delete_project_file_variant(uuid, text, uuid, integer) to authenticated;

comment on function public.reserve_project_file_variant(uuid, text, uuid, integer, bigint, integer, integer) is
  'Reserves a disposable WebP image derivative for a ready Project File original.';
