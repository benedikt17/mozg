-- Existing comments stay human. Agent comments can be inserted only by the
-- server after checking the dedicated MCP grant and workspace ownership.
alter table public.knowledge_annotations
  add column kind text not null default 'human'
    check (kind in ('human', 'agent')),
  add column suggested_text text
    check (suggested_text is null or length(suggested_text) <= 20000),
  add column source_revision bigint
    check (source_revision is null or source_revision > 0),
  add column applied_at timestamptz,
  add constraint knowledge_agent_proposal_fields check (
    (kind = 'human' and suggested_text is null and source_revision is null and applied_at is null)
    or (kind = 'agent' and source_revision is not null)
  );

alter table public.mcp_oauth_grants
  drop constraint mcp_oauth_grants_scope_check;
alter table public.mcp_oauth_grants
  add constraint mcp_oauth_grants_scope_check check (
    scope in ('knowledge:read', 'knowledge:read knowledge:neurocomment:create')
  );

drop policy knowledge_annotations_insert_editor on public.knowledge_annotations;
create policy knowledge_annotations_insert_editor
on public.knowledge_annotations for insert to authenticated
with check (
  public.has_workspace_role(workspace_id, array['owner', 'editor'])
  and created_by = (select auth.uid())
  and kind = 'human'
);

drop policy knowledge_annotations_update_own_editor on public.knowledge_annotations;
create policy knowledge_annotations_update_own_editor
on public.knowledge_annotations for update to authenticated
using (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
  and kind = 'human'
)
with check (
  public.has_workspace_role(workspace_id, array['owner', 'editor'])
  and created_by = (select auth.uid())
  and kind = 'human'
);

grant select, insert on public.knowledge_annotations to service_role;

-- No browser role can execute this function. It changes one exact Markdown
-- quote in one article and marks its proposal applied in one transaction.
create function public.apply_knowledge_neurocomment(
  target_user_id uuid,
  target_annotation_id uuid
)
returns table (status text, revision bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  proposal public.knowledge_annotations%rowtype;
  current_snapshot public.workspace_snapshots%rowtype;
  article jsonb;
  article_index integer;
  original_md text;
  updated_md text;
  quote_position integer;
  changed_snapshot jsonb;
begin
  select * into proposal from public.knowledge_annotations
    where id = target_annotation_id and created_by = target_user_id
    for update;
  if not found or proposal.kind <> 'agent' or proposal.suggested_text is null
    or proposal.applied_at is not null or proposal.resolved_at is not null then
    return query select 'unavailable'::text, null::bigint;
    return;
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = proposal.workspace_id
      and user_id = target_user_id and role = 'owner'
  ) then
    return query select 'forbidden'::text, null::bigint;
    return;
  end if;

  select * into current_snapshot from public.workspace_snapshots
    where workspace_id = proposal.workspace_id for update;
  if not found or current_snapshot.revision <> proposal.source_revision
    or current_snapshot.schema_version <> 3 then
    return query select 'conflict'::text, current_snapshot.revision;
    return;
  end if;

  select item.value, (item.ordinality - 1)::integer
    into article, article_index
    from jsonb_array_elements(current_snapshot.snapshot -> 'documents')
      with ordinality as item(value, ordinality)
    where item.value ->> 'id' = proposal.document_id
      and not (item.value ? 'deletedAt');
  if not found or jsonb_typeof(article -> 'content') <> 'array' then
    return query select 'conflict'::text, current_snapshot.revision;
    return;
  end if;

  select string_agg(line.value, E'\n' order by line.ordinality)
    into original_md
    from jsonb_array_elements_text(article -> 'content')
      with ordinality as line(value, ordinality);
  original_md := coalesce(original_md, '');
  quote_position := position(proposal.selected_text in original_md);
  if quote_position = 0 or position(
    proposal.selected_text in substring(original_md from quote_position + length(proposal.selected_text))
  ) > 0 then
    return query select 'conflict'::text, current_snapshot.revision;
    return;
  end if;

  updated_md := overlay(original_md placing proposal.suggested_text
    from quote_position for length(proposal.selected_text));
  changed_snapshot := jsonb_set(
    current_snapshot.snapshot,
    array['documents', article_index::text],
    jsonb_set(article, '{content}', to_jsonb(string_to_array(updated_md, E'\n')))
  );
  perform public.validate_desktop_snapshot_v3(3, changed_snapshot);
  update public.workspace_snapshots
    set snapshot = changed_snapshot, revision = current_snapshot.revision + 1
    where workspace_id = proposal.workspace_id;
  update public.knowledge_annotations
    set applied_at = now(), resolved_at = now()
    where id = proposal.id;
  return query select 'applied'::text, current_snapshot.revision + 1;
end;
$$;

revoke all on function public.apply_knowledge_neurocomment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_knowledge_neurocomment(uuid, uuid)
  to service_role;
