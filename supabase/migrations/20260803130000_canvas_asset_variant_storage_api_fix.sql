-- Storage's upsert path performs an UPDATE check. Pending variant metadata is
-- intentionally hidden from normal SELECT, so management checks use a narrow
-- SECURITY DEFINER predicate instead of bypassing metadata RLS broadly.

create function private.can_manage_canvas_asset_variant(
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
     );
$$;

drop policy canvas_asset_variants_storage_update on storage.objects;
create policy canvas_asset_variants_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'canvas-assets'
  and private.can_manage_canvas_asset_variant(
    split_part(name, '/', 1)::uuid,
    name
  )
)
with check (bucket_id = 'canvas-assets');

drop policy canvas_asset_variants_storage_delete on storage.objects;
create policy canvas_asset_variants_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'canvas-assets'
  and private.can_manage_canvas_asset_variant(
    split_part(name, '/', 1)::uuid,
    name
  )
);
