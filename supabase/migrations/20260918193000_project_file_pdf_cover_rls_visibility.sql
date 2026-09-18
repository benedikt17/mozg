-- Pending PDF first-page covers are intentionally visible only to editors so
-- they can retry a failed render and upload the exact reserved Storage object.
-- Keep the authorization predicate SECURITY DEFINER: the policy must inspect
-- the parent file without exposing pending file_variants themselves.

create or replace function private.can_read_project_file_variant(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid,
  target_kind text,
  target_ready_at timestamptz
)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public, private
as $$
  select public.is_workspace_member(target_workspace_id)
     and exists (
       select 1
       from public.project_files as file_row
       where file_row.workspace_id = target_workspace_id
         and file_row.project_id = target_project_id
         and file_row.id = target_file_id
         and file_row.ready_at is not null
         and file_row.deleted_at is null
     )
     and (
       target_ready_at is not null
       or (
         target_kind = 'pdf-page-1'
         and public.has_workspace_role(
           target_workspace_id,
           array['owner', 'editor']::text[]
         )
       )
     );
$$;

drop policy if exists file_variants_select_member on public.file_variants;

create policy file_variants_select_member
on public.file_variants
for select
to authenticated
using (
  private.can_read_project_file_variant(
    workspace_id,
    project_id,
    file_id,
    kind,
    ready_at
  )
);

revoke all on function private.can_read_project_file_variant(
  uuid, text, uuid, text, timestamptz
) from public, anon, authenticated;

comment on function private.can_read_project_file_variant(uuid, text, uuid, text, timestamptz) is
  'Authorizes ready Project File derivatives for members and pending PDF covers only for workspace owners and editors.';
