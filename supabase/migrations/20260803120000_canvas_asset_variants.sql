-- Multiresolution Canvas assets live beside the canonical asset metadata.
-- The original object and CanvasDocumentV2 remain unchanged.

alter table public.canvas_assets
  add constraint canvas_assets_workspace_canvas_id_key
  unique (workspace_id, canvas_id, id);

create table public.canvas_asset_variants (
  workspace_id uuid not null,
  canvas_id uuid not null,
  asset_id uuid not null,
  kind text not null check (kind in ('thumbnail', 'preview')),
  storage_path text not null,
  mime_type text not null check (mime_type = 'image/webp'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  pixel_width integer not null check (pixel_width > 0 and pixel_width <= 2560),
  pixel_height integer not null check (pixel_height > 0 and pixel_height <= 2560),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  primary key (workspace_id, canvas_id, asset_id, kind),
  constraint canvas_asset_variants_parent_fkey
    foreign key (workspace_id, canvas_id, asset_id)
    references public.canvas_assets (workspace_id, canvas_id, id)
    on delete cascade,
  constraint canvas_asset_variants_storage_path_check
    check (
      storage_path = workspace_id::text || '/' || canvas_id::text || '/' ||
        asset_id::text || '/' || kind || '.webp'
    ),
  constraint canvas_asset_variants_thumbnail_size_check
    check (kind <> 'thumbnail' or (pixel_width <= 512 and pixel_height <= 512))
);

alter table public.canvas_asset_variants enable row level security;
revoke all on table public.canvas_asset_variants from public, anon, authenticated;
grant select on table public.canvas_asset_variants to authenticated;

create function private.validate_canvas_asset_variant_dimensions()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  original record;
begin
  select width, height
    into original
    from public.canvas_assets
   where workspace_id = new.workspace_id
     and canvas_id = new.canvas_id
     and id = new.asset_id;
  if not found
     or new.pixel_width > original.width
     or new.pixel_height > original.height
     or abs(
       new.pixel_width::numeric / new.pixel_height::numeric -
       original.width::numeric / original.height::numeric
     ) > 1::numeric / new.pixel_height::numeric then
    raise exception using
      errcode = '22023',
      message = 'Canvas asset variant dimensions do not match the original asset';
  end if;
  return new;
end;
$$;

create trigger canvas_asset_variants_dimensions_trigger
before insert or update of pixel_width, pixel_height, workspace_id, canvas_id, asset_id
on public.canvas_asset_variants
for each row
execute function private.validate_canvas_asset_variant_dimensions();

create policy canvas_asset_variants_select_member
on public.canvas_asset_variants
for select
to authenticated
using (
  ready_at is not null
  and public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.canvas_assets as asset
    join public.canvases as canvas
      on canvas.id = asset.canvas_id
     and canvas.workspace_id = asset.workspace_id
    where asset.workspace_id = canvas_asset_variants.workspace_id
      and asset.canvas_id = canvas_asset_variants.canvas_id
      and asset.id = canvas_asset_variants.asset_id
      and asset.ready_at is not null
      and asset.deleted_at is null
      and canvas.deleted_at is null
  )
);

create policy canvas_asset_variants_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'canvas-assets'
  and exists (
    select 1
    from public.canvas_asset_variants as variant
    where variant.storage_path = name
      and variant.ready_at is not null
      and public.is_workspace_member(variant.workspace_id)
      and exists (
        select 1
        from public.canvas_assets as asset
        join public.canvases as canvas
          on canvas.id = asset.canvas_id
         and canvas.workspace_id = asset.workspace_id
        where asset.workspace_id = variant.workspace_id
          and asset.canvas_id = variant.canvas_id
          and asset.id = variant.asset_id
          and asset.deleted_at is null
          and canvas.deleted_at is null
      )
  )
);

create function private.can_upload_canvas_asset_variant(
  target_workspace_id uuid,
  target_storage_path text
)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public, private
as $$
  select public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     and exists (
       select 1
       from public.canvas_asset_variants as variant
       where variant.workspace_id = target_workspace_id
         and variant.storage_path = target_storage_path
         and variant.ready_at is null
     );
$$;

create policy canvas_asset_variants_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'canvas-assets'
  and private.can_upload_canvas_asset_variant(
    split_part(name, '/', 1)::uuid,
    name
  )
);

create policy canvas_asset_variants_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'canvas-assets'
  and exists (
    select 1
    from public.canvas_asset_variants as variant
    where variant.storage_path = name
      and public.has_workspace_role(variant.workspace_id, array['owner', 'editor'])
  )
)
with check (bucket_id = 'canvas-assets');

create policy canvas_asset_variants_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'canvas-assets'
  and exists (
    select 1
    from public.canvas_asset_variants as variant
    where variant.storage_path = name
      and public.has_workspace_role(variant.workspace_id, array['owner', 'editor'])
  )
);

create or replace function private.canvas_asset_variant_storage_path(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid,
  target_kind text
)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select target_workspace_id::text || '/' || target_canvas_id::text || '/' ||
    target_asset_id::text || '/' || target_kind || '.webp';
$$;

create function public.reserve_canvas_asset_variant(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid,
  target_kind text,
  target_byte_size bigint,
  target_pixel_width integer,
  target_pixel_height integer
)
returns table (
  workspace_id uuid,
  canvas_id uuid,
  asset_id uuid,
  kind text,
  storage_path text,
  mime_type text,
  byte_size bigint,
  pixel_width integer,
  pixel_height integer,
  created_at timestamptz,
  ready_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if target_kind not in ('thumbnail', 'preview')
     or target_byte_size is null
     or target_byte_size <= 0
     or target_byte_size > 20971520
     or target_pixel_width is null
     or target_pixel_height is null
     or target_pixel_width <= 0
     or target_pixel_height <= 0
     or target_pixel_width > 2560
     or target_pixel_height > 2560
     or (target_kind = 'thumbnail' and
         (target_pixel_width > 512 or target_pixel_height > 512)) then
    raise exception using errcode = '22023', message = 'Canvas asset variant metadata is invalid';
  end if;
  if not exists (
    select 1
    from public.canvas_assets as asset
    where asset.workspace_id = target_workspace_id
      and asset.canvas_id = target_canvas_id
      and asset.id = target_asset_id
      and asset.ready_at is not null
      and asset.deleted_at is null
  ) or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas asset variant access denied';
  end if;

  return query
  insert into public.canvas_asset_variants (
    workspace_id, canvas_id, asset_id, kind, storage_path, mime_type,
    byte_size, pixel_width, pixel_height, ready_at
  )
  values (
    target_workspace_id,
    target_canvas_id,
    target_asset_id,
    target_kind,
    private.canvas_asset_variant_storage_path(
      target_workspace_id, target_canvas_id, target_asset_id, target_kind
    ),
    'image/webp',
    target_byte_size,
    target_pixel_width,
    target_pixel_height,
    null
  )
  on conflict on constraint canvas_asset_variants_pkey do update
    set byte_size = excluded.byte_size,
        pixel_width = excluded.pixel_width,
        pixel_height = excluded.pixel_height,
        created_at = now(),
        ready_at = null
  returning
    canvas_asset_variants.workspace_id,
    canvas_asset_variants.canvas_id,
    canvas_asset_variants.asset_id,
    canvas_asset_variants.kind,
    canvas_asset_variants.storage_path,
    canvas_asset_variants.mime_type,
    canvas_asset_variants.byte_size,
    canvas_asset_variants.pixel_width,
    canvas_asset_variants.pixel_height,
    canvas_asset_variants.created_at,
    canvas_asset_variants.ready_at;
end;
$$;

create function public.finalize_canvas_asset_variant(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid,
  target_kind text
)
returns table (
  workspace_id uuid,
  canvas_id uuid,
  asset_id uuid,
  kind text,
  storage_path text,
  mime_type text,
  byte_size bigint,
  pixel_width integer,
  pixel_height integer,
  created_at timestamptz,
  ready_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (
    select 1
    from public.canvas_asset_variants as variant
    where variant.workspace_id = target_workspace_id
      and variant.canvas_id = target_canvas_id
      and variant.asset_id = target_asset_id
      and variant.kind = target_kind
      and variant.ready_at is null
      and exists (
        select 1
        from storage.objects
        where bucket_id = 'canvas-assets'
          and name = variant.storage_path
      )
  ) then
    raise exception using errcode = '22023', message = 'Canvas asset variant object is missing';
  end if;
  return query
  update public.canvas_asset_variants as variant
     set ready_at = coalesce(variant.ready_at, now())
   where variant.workspace_id = target_workspace_id
     and variant.canvas_id = target_canvas_id
     and variant.asset_id = target_asset_id
     and variant.kind = target_kind
  returning
    variant.workspace_id,
    variant.canvas_id,
    variant.asset_id,
    variant.kind,
    variant.storage_path,
    variant.mime_type,
    variant.byte_size,
    variant.pixel_width,
    variant.pixel_height,
    variant.created_at,
    variant.ready_at;
end;
$$;

create function public.delete_canvas_asset_variant(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid,
  target_kind text
)
returns table (deleted boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas asset variant access denied';
  end if;
  return query
  delete from public.canvas_asset_variants
   where workspace_id = target_workspace_id
     and canvas_id = target_canvas_id
     and asset_id = target_asset_id
     and kind = target_kind
  returning true;
end;
$$;

create function public.delete_canvas_asset_variants(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas asset variant access denied';
  end if;
  delete from public.canvas_asset_variants
   where workspace_id = target_workspace_id
     and canvas_id = target_canvas_id
     and asset_id = target_asset_id;
end;
$$;

create or replace function public.delete_canvas_asset(
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
  delete from public.canvas_asset_variants
   where workspace_id = target_workspace_id
     and canvas_id = target_canvas_id
     and asset_id = target_asset_id;
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

revoke all on function private.canvas_asset_variant_storage_path(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reserve_canvas_asset_variant(uuid, uuid, uuid, text, bigint, integer, integer) from public, anon, authenticated;
revoke all on function public.finalize_canvas_asset_variant(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.delete_canvas_asset_variant(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.delete_canvas_asset_variants(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_canvas_asset_variant(uuid, uuid, uuid, text, bigint, integer, integer) to authenticated;
grant execute on function public.finalize_canvas_asset_variant(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.delete_canvas_asset_variant(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.delete_canvas_asset_variants(uuid, uuid, uuid) to authenticated;
