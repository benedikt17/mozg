-- Canvas assets become Canvas-scoped metadata with a private Storage object
-- lifecycle. Existing metadata rows must be migrated explicitly before this
-- checkpoint can be applied to a database that already contains asset data.

do $$
begin
  if exists (select 1 from public.canvas_assets) then
    raise exception using
      errcode = '55000',
      message = 'Existing canvas_assets rows require an explicit canvas_id migration';
  end if;
end;
$$;

alter table public.canvas_assets
  add column canvas_id uuid not null;

alter table public.canvas_assets
  drop constraint if exists canvas_assets_storage_key_check,
  drop constraint if exists canvas_assets_preview_storage_key_check,
  drop constraint if exists canvas_assets_check,
  drop constraint if exists canvas_assets_check1;

alter table public.canvas_assets
  add constraint canvas_assets_canvas_workspace_fkey
    foreign key (workspace_id, canvas_id)
    references public.canvases (workspace_id, id),
  add constraint canvas_assets_storage_key_contract_check
    check (
      storage_key = workspace_id::text || '/' || canvas_id::text || '/' || id::text || '/original'
    ),
  add constraint canvas_assets_preview_storage_key_contract_check
    check (
      preview_storage_key is null
      or preview_storage_key = workspace_id::text || '/' || canvas_id::text || '/' || id::text || '/preview.webp'
    );

create or replace function private.canvas_asset_storage_key(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid
)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select target_workspace_id::text || '/' || target_canvas_id::text || '/' || target_asset_id::text || '/original';
$$;

create or replace function private.assert_canvas_asset_metadata(
  target_mime_type text,
  target_byte_size bigint,
  target_width integer,
  target_height integer,
  target_checksum text
)
returns void
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
begin
  if target_mime_type is null
     or target_mime_type not in ('image/png', 'image/jpeg', 'image/webp') then
    raise exception using errcode = '22023', message = 'unsupported Canvas asset MIME type';
  end if;
  if target_byte_size is null or target_byte_size <= 0 or target_byte_size > 20971520 then
    raise exception using errcode = '22023', message = 'Canvas asset byte size is invalid';
  end if;
  if target_width is null or target_height is null
     or target_width <= 0 or target_height <= 0
     or target_width > 10000 or target_height > 10000
     or (target_width::bigint * target_height::bigint) > 40000000 then
    raise exception using errcode = '22023', message = 'Canvas asset dimensions are invalid';
  end if;
  if target_checksum is not null
     and (btrim(target_checksum) = '' or private.canvas_utf16_length(target_checksum) > 256) then
    raise exception using errcode = '22023', message = 'Canvas asset checksum is invalid';
  end if;
end;
$$;

create or replace function private.assert_canvas_asset_references(
  target_canvas_id uuid,
  target_workspace_id uuid,
  target_document jsonb
)
returns void
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if exists (
    select 1
    from jsonb_array_elements(target_document -> 'nodes') as node_item
    where node_item ->> 'kind' = 'image'
      and not exists (
        select 1
        from public.canvas_assets as asset
        where asset.id::text = node_item ->> 'assetId'
          and asset.workspace_id = target_workspace_id
          and asset.canvas_id = target_canvas_id
          and asset.ready_at is not null
          and asset.deleted_at is null
      )
  ) then
    raise exception using errcode = '22023', message = 'Canvas image references an unavailable asset';
  end if;
end;
$$;

create or replace function public.validate_canvas_row_document()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  perform public.validate_canvas_document_v2(new.schema_version, new.document);
  perform private.assert_canvas_asset_references(new.id, new.workspace_id, new.document);
  return new;
end;
$$;

create or replace function public.save_canvas_document(
  target_canvas_id uuid,
  target_expected_revision bigint,
  target_title text,
  target_document jsonb
)
returns table (status text, revision bigint)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_workspace_id uuid;
  current_revision bigint;
  current_deleted_at timestamptz;
begin
  if target_expected_revision is null or target_expected_revision <= 0 then
    raise exception using errcode = '22023', message = 'expected Canvas revision must be positive';
  end if;

  select workspace_id, canvases.revision, deleted_at
    into current_workspace_id, current_revision, current_deleted_at
    from public.canvases
   where canvases.id = target_canvas_id;
  if current_workspace_id is null
     or current_deleted_at is not null
     or not public.has_workspace_role(current_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas access denied';
  end if;

  perform public.assert_canvas_title(target_title);
  perform public.validate_canvas_document_v2(2::smallint, target_document);
  perform private.assert_canvas_asset_references(target_canvas_id, current_workspace_id, target_document);

  return query
  update public.canvases
     set title = target_title,
         schema_version = 2,
         document = target_document,
         revision = canvases.revision + 1
   where canvases.id = target_canvas_id
     and canvases.deleted_at is null
     and canvases.revision = target_expected_revision
  returning 'saved'::text, canvases.revision;

  if found then
    return;
  end if;

  select canvases.revision
    into current_revision
    from public.canvases
   where canvases.id = target_canvas_id;
  if current_revision is null then
    raise exception using errcode = '42501', message = 'Canvas access denied';
  end if;
  return query select 'conflict'::text, current_revision;
end;
$$;

drop policy if exists canvas_assets_select_member on public.canvas_assets;
drop policy if exists canvas_assets_insert_member on public.canvas_assets;

create policy canvas_assets_select_member
on public.canvas_assets
for select
to authenticated
using (
  deleted_at is null
  and public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.canvases
    where canvases.id = canvas_assets.canvas_id
      and canvases.workspace_id = canvas_assets.workspace_id
      and canvases.deleted_at is null
  )
  and (
    ready_at is not null
    or public.has_workspace_role(workspace_id, array['owner', 'editor'])
  )
);

revoke all on table public.canvas_assets from public, anon, authenticated;
grant select on table public.canvas_assets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'canvas-assets',
  'canvas-assets',
  false,
  20971520,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists canvas_assets_storage_select on storage.objects;
drop policy if exists canvas_assets_storage_insert on storage.objects;
drop policy if exists canvas_assets_storage_delete on storage.objects;

create policy canvas_assets_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'canvas-assets'
  and exists (
    select 1
    from public.canvas_assets as asset
    where asset.deleted_at is null
      and asset.ready_at is not null
      and public.is_workspace_member(asset.workspace_id)
      and exists (
        select 1
        from public.canvases
        where canvases.id = asset.canvas_id
          and canvases.workspace_id = asset.workspace_id
          and canvases.deleted_at is null
      )
      and (asset.storage_key = name or asset.preview_storage_key = name)
  )
);

create policy canvas_assets_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'canvas-assets'
  and exists (
    select 1
    from public.canvas_assets as asset
    where asset.deleted_at is null
      and asset.ready_at is null
      and asset.storage_key = name
      and public.has_workspace_role(asset.workspace_id, array['owner', 'editor'])
      and exists (
        select 1
        from public.canvases
        where canvases.id = asset.canvas_id
          and canvases.workspace_id = asset.workspace_id
          and canvases.deleted_at is null
      )
  )
);

create policy canvas_assets_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'canvas-assets'
  and exists (
    select 1
    from public.canvas_assets as asset
    where asset.deleted_at is null
      and asset.storage_key = name
      and public.has_workspace_role(asset.workspace_id, array['owner', 'editor'])
      and exists (
        select 1
        from public.canvases
        where canvases.id = asset.canvas_id
          and canvases.workspace_id = asset.workspace_id
          and canvases.deleted_at is null
      )
  )
);

create function public.reserve_canvas_asset(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid,
  target_mime_type text,
  target_byte_size bigint,
  target_width integer,
  target_height integer,
  target_checksum text default null
)
returns table (
  id uuid,
  workspace_id uuid,
  canvas_id uuid,
  storage_key text,
  preview_storage_key text,
  mime_type text,
  byte_size bigint,
  width integer,
  height integer,
  checksum text,
  created_by uuid,
  created_at timestamptz,
  ready_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (
    select 1
    from public.canvases
    where canvases.id = target_canvas_id
      and canvases.workspace_id = target_workspace_id
      and canvases.deleted_at is null
  ) or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas asset access denied';
  end if;

  perform private.assert_canvas_asset_metadata(
    target_mime_type,
    target_byte_size,
    target_width,
    target_height,
    target_checksum
  );

  return query
  insert into public.canvas_assets (
    id,
    workspace_id,
    canvas_id,
    storage_key,
    mime_type,
    byte_size,
    width,
    height,
    checksum,
    created_by
  )
  values (
    target_asset_id,
    target_workspace_id,
    target_canvas_id,
    private.canvas_asset_storage_key(target_workspace_id, target_canvas_id, target_asset_id),
    target_mime_type,
    target_byte_size,
    target_width,
    target_height,
    target_checksum,
    (select auth.uid())
  )
  returning
    canvas_assets.id,
    canvas_assets.workspace_id,
    canvas_assets.canvas_id,
    canvas_assets.storage_key,
    canvas_assets.preview_storage_key,
    canvas_assets.mime_type,
    canvas_assets.byte_size,
    canvas_assets.width,
    canvas_assets.height,
    canvas_assets.checksum,
    canvas_assets.created_by,
    canvas_assets.created_at,
    canvas_assets.ready_at,
    canvas_assets.deleted_at;
end;
$$;

create function public.finalize_canvas_asset(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid
)
returns table (
  id uuid,
  workspace_id uuid,
  canvas_id uuid,
  storage_key text,
  preview_storage_key text,
  mime_type text,
  byte_size bigint,
  width integer,
  height integer,
  checksum text,
  created_by uuid,
  created_at timestamptz,
  ready_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_storage_key text;
  current_ready_at timestamptz;
begin
  if not exists (
    select 1
    from public.canvases
    where canvases.id = target_canvas_id
      and canvases.workspace_id = target_workspace_id
      and canvases.deleted_at is null
  ) or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas asset access denied';
  end if;

  select asset.storage_key, asset.ready_at
    into current_storage_key, current_ready_at
    from public.canvas_assets as asset
   where asset.id = target_asset_id
     and asset.workspace_id = target_workspace_id
     and asset.canvas_id = target_canvas_id
     and asset.deleted_at is null;
  if current_storage_key is null then
    raise exception using errcode = '42501', message = 'Canvas asset access denied';
  end if;

  if current_ready_at is null
     and not exists (
       select 1
       from storage.objects
       where bucket_id = 'canvas-assets'
         and name = current_storage_key
     ) then
    raise exception using errcode = '22023', message = 'Canvas asset object is missing';
  end if;

  return query
  update public.canvas_assets as asset
     set ready_at = coalesce(asset.ready_at, now())
   where asset.id = target_asset_id
     and asset.workspace_id = target_workspace_id
     and asset.canvas_id = target_canvas_id
     and asset.deleted_at is null
  returning
    asset.id,
    asset.workspace_id,
    asset.canvas_id,
    asset.storage_key,
    asset.preview_storage_key,
    asset.mime_type,
    asset.byte_size,
    asset.width,
    asset.height,
    asset.checksum,
    asset.created_by,
    asset.created_at,
    asset.ready_at,
    asset.deleted_at;
end;
$$;

create function public.delete_canvas_asset(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid
)
returns table (deleted boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (
    select 1
    from public.canvases
    where canvases.id = target_canvas_id
      and canvases.workspace_id = target_workspace_id
      and canvases.deleted_at is null
  ) or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas asset access denied';
  end if;

  return query
  update public.canvas_assets as asset
     set deleted_at = coalesce(asset.deleted_at, now())
   where asset.id = target_asset_id
     and asset.workspace_id = target_workspace_id
     and asset.canvas_id = target_canvas_id
  returning asset.deleted_at is not null and asset.ready_at is not null;

  if not found then
    raise exception using errcode = '42501', message = 'Canvas asset access denied';
  end if;
end;
$$;

revoke all on function private.canvas_asset_storage_key(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.assert_canvas_asset_metadata(text, bigint, integer, integer, text) from public, anon, authenticated;
revoke all on function private.assert_canvas_asset_references(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.reserve_canvas_asset(uuid, uuid, uuid, text, bigint, integer, integer, text) from public, anon, authenticated;
revoke all on function public.finalize_canvas_asset(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_canvas_asset(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_canvas_asset(uuid, uuid, uuid, text, bigint, integer, integer, text) to authenticated;
grant execute on function public.finalize_canvas_asset(uuid, uuid, uuid) to authenticated;
grant execute on function public.delete_canvas_asset(uuid, uuid, uuid) to authenticated;
