-- Files B2: pending file_variants are intentionally hidden by table RLS.
-- Storage INSERT still has to validate the reservation before a derivative object
-- can be written, so use a narrow SECURITY DEFINER predicate rather than exposing
-- pending metadata to normal authenticated SELECTs.

create function private.can_upload_project_file_variant(
  target_workspace_id uuid,
  target_storage_path text
)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public, private
as $$
  select public.has_workspace_role(
           target_workspace_id,
           array['owner', 'editor']::text[]
         )
     and exists (
       select 1
       from public.file_variants as variant_row
       join public.project_files as file_row
         on file_row.workspace_id = variant_row.workspace_id
        and file_row.project_id = variant_row.project_id
        and file_row.id = variant_row.file_id
       where variant_row.workspace_id = target_workspace_id
         and variant_row.storage_path = target_storage_path
         and variant_row.ready_at is null
         and file_row.ready_at is not null
         and file_row.deleted_at is null
     );
$$;

drop policy if exists project_file_variants_storage_insert on storage.objects;

create policy project_file_variants_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-files'
  and private.can_upload_project_file_variant(
    split_part(name, '/', 1)::uuid,
    name
  )
);

comment on function private.can_upload_project_file_variant(uuid, text) is
  'Authorizes Storage INSERT for an editor-owned pending Project File derivative reservation without exposing pending file_variants through table RLS.';
