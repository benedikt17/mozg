-- Proposed folder and Markdown files are invisible to the main Knowledge catalog
-- until their owner publishes the bundle.
create table public.knowledge_neuro_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  folder_path text[] not null,
  documents jsonb not null check (jsonb_typeof(documents) = 'array'),
  revision integer not null default 1 check (revision > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (array_length(folder_path, 1) between 1 and 8),
  check (jsonb_array_length(documents) between 1 and 10)
);
create index knowledge_neuro_drafts_owner_idx
  on public.knowledge_neuro_drafts (workspace_id, created_by, created_at desc);
create trigger knowledge_neuro_drafts_set_updated_at
  before update on public.knowledge_neuro_drafts
  for each row execute function public.set_updated_at();
alter table public.knowledge_neuro_drafts enable row level security;
create policy knowledge_neuro_drafts_select_owner
  on public.knowledge_neuro_drafts for select to authenticated
  using (created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['owner']));
revoke all on public.knowledge_neuro_drafts from public, anon, authenticated;
grant select on public.knowledge_neuro_drafts to authenticated;
grant select, insert, update on public.knowledge_neuro_drafts to service_role;

-- A single transaction publishes the selected documents into the snapshot.
create function public.publish_knowledge_neuro_draft(target_user_id uuid, target_draft_id uuid, expected_revision integer)
returns table (status text, revision bigint)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  draft public.knowledge_neuro_drafts%rowtype;
  current_snapshot public.workspace_snapshots%rowtype;
  changed_snapshot jsonb;
  item jsonb;
  next_folders jsonb;
  next_documents jsonb;
  remaining_documents jsonb;
  folder_prefix text[] := '{}';
  folder_part text;
  folder_exists boolean;
  document_count integer := 0;
begin
  select * into draft from public.knowledge_neuro_drafts
    where id = target_draft_id and created_by = target_user_id for update;
  if not found or draft.published_at is not null or draft.revision <> expected_revision then
    return query select 'conflict'::text, null::bigint;
    return;
  end if;
  if not exists (select 1 from public.workspace_members
    where workspace_id = draft.workspace_id and user_id = target_user_id and role = 'owner') then
    return query select 'forbidden'::text, null::bigint;
    return;
  end if;
  select * into current_snapshot from public.workspace_snapshots
    where workspace_id = draft.workspace_id for update;
  if not found or current_snapshot.schema_version <> 3
    or not exists (select 1 from jsonb_array_elements(current_snapshot.snapshot -> 'projects') p
      where p ->> 'id' = draft.project_id) then
    return query select 'conflict'::text, current_snapshot.revision;
    return;
  end if;

  next_documents := current_snapshot.snapshot -> 'documents';
  for item in select value from jsonb_array_elements(draft.documents) loop
    if item ->> 'selected' = 'true' then
      document_count := document_count + 1;
      next_documents := next_documents || jsonb_build_array(jsonb_build_object(
        'id', 'neuro-document-' || gen_random_uuid()::text,
        'projectId', draft.project_id,
        'folder', draft.folder_path[array_length(draft.folder_path, 1)],
        'folderPath', to_jsonb(draft.folder_path),
        'title', item ->> 'title',
        'excerpt', '',
        'content', to_jsonb(string_to_array(item ->> 'markdown', E'\n')),
        'backlinks', '[]'::jsonb
      ));
    end if;
  end loop;
  if document_count = 0 then
    return query select 'empty'::text, current_snapshot.revision;
    return;
  end if;

  next_folders := current_snapshot.snapshot -> 'knowledgeFolders';
  foreach folder_part in array draft.folder_path loop
    folder_prefix := array_append(folder_prefix, folder_part);
    select exists(select 1 from jsonb_array_elements(next_folders) f
      where f ->> 'projectId' = draft.project_id
        and f -> 'path' = to_jsonb(folder_prefix)) into folder_exists;
    if not folder_exists then
      next_folders := next_folders || jsonb_build_array(jsonb_build_object(
        'id', 'neuro-folder-' || gen_random_uuid()::text,
        'projectId', draft.project_id,
        'path', to_jsonb(folder_prefix)
      ));
    end if;
  end loop;
  changed_snapshot := jsonb_set(jsonb_set(current_snapshot.snapshot,
    '{knowledgeFolders}', next_folders), '{documents}', next_documents);
  perform public.validate_desktop_snapshot_v3(3::smallint, changed_snapshot);
  update public.workspace_snapshots set snapshot = changed_snapshot,
    revision = current_snapshot.revision + 1 where workspace_id = draft.workspace_id;
  select coalesce(jsonb_agg(value), '[]'::jsonb) into remaining_documents
    from jsonb_array_elements(draft.documents) value
    where value ->> 'selected' <> 'true';
  update public.knowledge_neuro_drafts set
    documents = case when jsonb_array_length(remaining_documents) = 0
      then draft.documents else remaining_documents end,
    published_at = case when jsonb_array_length(remaining_documents) = 0
      then now() else null end,
    revision = draft.revision + 1
    where id = draft.id;
  return query select 'published'::text, current_snapshot.revision + 1;
end;
$$;
revoke all on function public.publish_knowledge_neuro_draft(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.publish_knowledge_neuro_draft(uuid, uuid, integer)
  to service_role;
