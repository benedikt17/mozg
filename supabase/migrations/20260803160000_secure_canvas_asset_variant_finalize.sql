-- Finalize only a variant reserved inside the caller's authorized workspace.
-- Keep the original function contract while closing the SECURITY DEFINER gap.

create or replace function public.finalize_canvas_asset_variant(
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
declare
  reserved_variant public.canvas_asset_variants%rowtype;
begin
  if (select auth.uid()) is null
     or not public.has_workspace_role(
       target_workspace_id,
       array['owner', 'editor']
     ) then
    raise exception using
      errcode = '42501',
      message = 'Canvas asset variant access denied';
  end if;

  if target_kind not in ('thumbnail', 'preview') then
    raise exception using
      errcode = '22023',
      message = 'Canvas asset variant metadata is invalid';
  end if;

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
     and variant.storage_path = private.canvas_asset_variant_storage_path(
       target_workspace_id,
       target_canvas_id,
       target_asset_id,
       target_kind
     )
     and variant.ready_at is null
     and asset.ready_at is not null
     and asset.deleted_at is null
     and canvas.deleted_at is null;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Canvas asset variant access denied';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'canvas-assets'
      and name = reserved_variant.storage_path
  ) then
    raise exception using
      errcode = '22023',
      message = 'Canvas asset variant object is missing';
  end if;

  return query
  update public.canvas_asset_variants as variant
     set ready_at = now()
   where variant.workspace_id = target_workspace_id
     and variant.canvas_id = target_canvas_id
     and variant.asset_id = target_asset_id
     and variant.kind = target_kind
     and variant.ready_at is null
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

revoke all on function public.finalize_canvas_asset_variant(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.finalize_canvas_asset_variant(uuid, uuid, uuid, text)
  to authenticated;
