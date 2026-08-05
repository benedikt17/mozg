-- Canvas Image Pyramid V2 keeps the legacy thumbnail/preview contract intact
-- while making target_max_edge the canonical identifier for future tiers.

alter table public.canvas_asset_variants
  add column target_max_edge integer;

update public.canvas_asset_variants
   set target_max_edge = case kind
     when 'thumbnail' then 512
     when 'preview' then 2560
   end
 where target_max_edge is null;

alter table public.canvas_asset_variants
  alter column target_max_edge set not null,
  drop constraint canvas_asset_variants_kind_check,
  drop constraint canvas_asset_variants_storage_path_check,
  drop constraint canvas_asset_variants_thumbnail_size_check,
  drop constraint canvas_asset_variants_pixel_width_check,
  drop constraint canvas_asset_variants_pixel_height_check,
  add constraint canvas_asset_variants_target_max_edge_check
    check (target_max_edge > 0 and target_max_edge <= 10000),
  add constraint canvas_asset_variants_pixel_dimensions_check
    check (
      pixel_width > 0 and pixel_width <= 10000
      and pixel_height > 0 and pixel_height <= 10000
      and pixel_width <= target_max_edge
      and pixel_height <= target_max_edge
    ),
  add constraint canvas_asset_variants_identity_check
    check (
      (kind = 'thumbnail'
        and target_max_edge = 512
        and storage_path = workspace_id::text || '/' || canvas_id::text || '/'
          || asset_id::text || '/thumbnail.webp')
      or (kind = 'preview'
        and target_max_edge = 2560
        and storage_path = workspace_id::text || '/' || canvas_id::text || '/'
          || asset_id::text || '/preview.webp')
      or (kind = 'edge-' || target_max_edge::text
        and storage_path = workspace_id::text || '/' || canvas_id::text || '/'
          || asset_id::text || '/edge-' || target_max_edge::text || '.webp')
    ),
  add constraint canvas_asset_variants_target_max_edge_key
    unique (workspace_id, canvas_id, asset_id, target_max_edge);

-- Preserve the deployed RPC signature and returned shape. Its writes must now
-- include the canonical tier introduced above.
create or replace function public.reserve_canvas_asset_variant(
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
    workspace_id, canvas_id, asset_id, kind, target_max_edge, storage_path,
    mime_type, byte_size, pixel_width, pixel_height, ready_at
  )
  values (
    target_workspace_id,
    target_canvas_id,
    target_asset_id,
    target_kind,
    case target_kind when 'thumbnail' then 512 else 2560 end,
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

create function private.canvas_asset_variant_v2_storage_path(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid,
  target_max_edge integer
)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select target_workspace_id::text || '/' || target_canvas_id::text || '/'
    || target_asset_id::text || '/edge-' || target_max_edge::text || '.webp';
$$;

create function public.reserve_canvas_asset_variant_v2(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid,
  requested_max_edge integer,
  target_byte_size bigint,
  target_pixel_width integer,
  target_pixel_height integer
)
returns table (
  workspace_id uuid,
  canvas_id uuid,
  asset_id uuid,
  kind text,
  target_max_edge integer,
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
declare
  target_kind text;
begin
  if (select auth.uid()) is null
     or requested_max_edge is null
     or requested_max_edge <= 0
     or requested_max_edge > 10000
     or target_byte_size is null
     or target_byte_size <= 0
     or target_byte_size > 20971520
     or target_pixel_width is null
     or target_pixel_height is null
     or target_pixel_width <= 0
     or target_pixel_height <= 0
     or target_pixel_width > 10000
     or target_pixel_height > 10000
     or target_pixel_width > requested_max_edge
     or target_pixel_height > requested_max_edge then
    raise exception using errcode = '22023', message = 'Canvas asset variant metadata is invalid';
  end if;
  if not exists (
    select 1
    from public.canvas_assets as asset
    join public.canvases as canvas
      on canvas.workspace_id = asset.workspace_id
     and canvas.id = asset.canvas_id
    where asset.workspace_id = target_workspace_id
      and asset.canvas_id = target_canvas_id
      and asset.id = target_asset_id
      and asset.ready_at is not null
      and asset.deleted_at is null
      and canvas.deleted_at is null
  ) or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas asset variant access denied';
  end if;

  target_kind := 'edge-' || requested_max_edge::text;
  if exists (
    select 1
    from public.canvas_asset_variants as variant
    where variant.workspace_id = target_workspace_id
      and variant.canvas_id = target_canvas_id
      and variant.asset_id = target_asset_id
      and variant.target_max_edge = requested_max_edge
      and variant.kind <> target_kind
  ) then
    raise exception using errcode = '23505', message = 'Canvas asset variant tier conflicts with a legacy variant';
  end if;

  return query
  insert into public.canvas_asset_variants (
    workspace_id, canvas_id, asset_id, kind, target_max_edge, storage_path,
    mime_type, byte_size, pixel_width, pixel_height, ready_at
  )
  values (
    target_workspace_id,
    target_canvas_id,
    target_asset_id,
    target_kind,
    requested_max_edge,
    private.canvas_asset_variant_v2_storage_path(
      target_workspace_id, target_canvas_id, target_asset_id, requested_max_edge
    ),
    'image/webp',
    target_byte_size,
    target_pixel_width,
    target_pixel_height,
    null
  )
  on conflict on constraint canvas_asset_variants_target_max_edge_key do update
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
    canvas_asset_variants.target_max_edge,
    canvas_asset_variants.storage_path,
    canvas_asset_variants.mime_type,
    canvas_asset_variants.byte_size,
    canvas_asset_variants.pixel_width,
    canvas_asset_variants.pixel_height,
    canvas_asset_variants.created_at,
    canvas_asset_variants.ready_at;
end;
$$;

create function public.finalize_canvas_asset_variant_v2(
  target_workspace_id uuid,
  target_canvas_id uuid,
  target_asset_id uuid,
  requested_max_edge integer
)
returns table (
  workspace_id uuid,
  canvas_id uuid,
  asset_id uuid,
  kind text,
  target_max_edge integer,
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
declare
  reserved_variant public.canvas_asset_variants%rowtype;
  target_kind text;
begin
  if (select auth.uid()) is null
     or requested_max_edge is null
     or requested_max_edge <= 0
     or requested_max_edge > 10000
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas asset variant access denied';
  end if;

  target_kind := 'edge-' || requested_max_edge::text;
  select variant.*
    into reserved_variant
    from public.canvas_asset_variants as variant
    join public.canvas_assets as asset
      on asset.workspace_id = variant.workspace_id
     and asset.canvas_id = variant.canvas_id
     and asset.id = variant.asset_id
    join public.canvases as canvas
      on canvas.workspace_id = asset.workspace_id
     and canvas.id = asset.canvas_id
   where variant.workspace_id = target_workspace_id
     and variant.canvas_id = target_canvas_id
     and variant.asset_id = target_asset_id
     and variant.kind = target_kind
     and variant.target_max_edge = requested_max_edge
     and variant.storage_path = private.canvas_asset_variant_v2_storage_path(
       target_workspace_id, target_canvas_id, target_asset_id, requested_max_edge
     )
     and variant.ready_at is null
     and asset.ready_at is not null
     and asset.deleted_at is null
     and canvas.deleted_at is null;

  if not found then
    raise exception using errcode = '42501', message = 'Canvas asset variant access denied';
  end if;
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'canvas-assets'
      and name = reserved_variant.storage_path
  ) then
    raise exception using errcode = '22023', message = 'Canvas asset variant object is missing';
  end if;

  return query
  update public.canvas_asset_variants as variant
     set ready_at = now()
   where variant.workspace_id = target_workspace_id
     and variant.canvas_id = target_canvas_id
     and variant.asset_id = target_asset_id
     and variant.target_max_edge = requested_max_edge
     and variant.kind = target_kind
     and variant.ready_at is null
  returning
    variant.workspace_id,
    variant.canvas_id,
    variant.asset_id,
    variant.kind,
    variant.target_max_edge,
    variant.storage_path,
    variant.mime_type,
    variant.byte_size,
    variant.pixel_width,
    variant.pixel_height,
    variant.created_at,
    variant.ready_at;
end;
$$;

revoke all on function private.canvas_asset_variant_v2_storage_path(uuid, uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.reserve_canvas_asset_variant_v2(uuid, uuid, uuid, integer, bigint, integer, integer)
  from public, anon, authenticated;
revoke all on function public.finalize_canvas_asset_variant_v2(uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_canvas_asset_variant_v2(uuid, uuid, uuid, integer, bigint, integer, integer)
  to authenticated;
grant execute on function public.finalize_canvas_asset_variant_v2(uuid, uuid, uuid, integer)
  to authenticated;
