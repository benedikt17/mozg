-- Stage A1 hardening: qualify the outer storage.objects.name reference inside
-- Files Storage policies.
--
-- The original policy compared `file_row.storage_key = name` from inside a
-- subquery. Because public.project_files also has a `name` column, PostgreSQL
-- resolved that unqualified identifier to file_row.name instead of the outer
-- storage.objects.name. Metadata reservation therefore succeeded while the
-- actual Storage INSERT was denied by RLS.

drop policy if exists project_files_storage_select on storage.objects;
drop policy if exists project_files_storage_insert on storage.objects;

create policy project_files_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-files'
  and (
    exists (
      select 1
      from public.project_files as file_row
      where file_row.storage_key = storage.objects.name
        and file_row.deleted_at is null
        and public.is_workspace_member(file_row.workspace_id)
        and (
          file_row.ready_at is not null
          or public.has_workspace_role(file_row.workspace_id, array['owner', 'editor'])
        )
    )
    or exists (
      select 1
      from public.file_variants as variant_row
      join public.project_files as file_row
        on file_row.workspace_id = variant_row.workspace_id
       and file_row.project_id = variant_row.project_id
       and file_row.id = variant_row.file_id
      where variant_row.storage_path = storage.objects.name
        and variant_row.ready_at is not null
        and file_row.ready_at is not null
        and file_row.deleted_at is null
        and public.is_workspace_member(file_row.workspace_id)
    )
  )
);

create policy project_files_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-files'
  and exists (
    select 1
    from public.project_files as file_row
    where file_row.storage_key = storage.objects.name
      and file_row.ready_at is null
      and file_row.deleted_at is null
      and public.has_workspace_role(file_row.workspace_id, array['owner', 'editor'])
  )
);
