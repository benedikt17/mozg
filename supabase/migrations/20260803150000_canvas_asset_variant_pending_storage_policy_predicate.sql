drop policy if exists canvas_asset_variants_storage_select on storage.objects;

create policy canvas_asset_variants_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'canvas-assets'
  and (
    exists (
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
    or private.can_manage_canvas_asset_variant(
      (split_part(name, '/', 1))::uuid,
      name
    )
  )
);
