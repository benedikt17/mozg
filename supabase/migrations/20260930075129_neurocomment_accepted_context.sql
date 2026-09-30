-- Preserve strict quote/context checks while allowing neighboring accepted edits.
create or replace function public.apply_knowledge_neurocomment(
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
  before_quote text;
  after_quote text;
  changed_snapshot jsonb;
  accepted public.knowledge_annotations%rowtype;
  review_md text;
  accepted_text text;
  prior_text text;
  accepted_position integer;
  review_position integer;
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
  if not found or current_snapshot.schema_version <> 3
    or current_snapshot.revision < proposal.source_revision then
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

  before_quote := substring(original_md from 1 for quote_position - 1);
  after_quote := substring(original_md from quote_position + length(proposal.selected_text));
  -- If another edit moved the quote, require its original nearby context.
  if current_snapshot.revision <> proposal.source_revision and (
    right(before_quote, length(proposal.prefix)) <> proposal.prefix
    or left(after_quote, length(proposal.suffix)) <> proposal.suffix
  ) then
    -- Only changes explicitly accepted by this owner after this proposal was
    -- created may explain a changed context. Reconstruct it in memory; never
    -- roll back the stored article. Manual edits still cause a conflict.
    review_md := original_md;
    for accepted in
      select * from public.knowledge_annotations a
      where a.workspace_id = proposal.workspace_id
        and a.document_id = proposal.document_id
        and a.created_by = target_user_id and a.kind = 'agent'
        and a.applied_at > proposal.created_at
      order by a.applied_at desc, a.id desc
    loop
      case accepted.proposal_action
        when 'replace' then
          accepted_text := accepted.suggested_text;
          prior_text := accepted.selected_text;
        when 'delete' then
          accepted_text := accepted.prefix || accepted.suffix;
          prior_text := accepted.prefix || accepted.selected_text || accepted.suffix;
        when 'insert_before' then
          accepted_text := accepted.suggested_text || accepted.selected_text;
          prior_text := accepted.selected_text;
        when 'insert_after' then
          accepted_text := accepted.selected_text || accepted.suggested_text;
          prior_text := accepted.selected_text;
      end case;
      if accepted_text is null or accepted_text = '' then continue; end if;
      accepted_position := position(accepted_text in review_md);
      if accepted_position = 0 or position(
        accepted_text in substring(review_md from accepted_position + length(accepted_text))
      ) > 0 then continue; end if;
      review_md := substring(review_md from 1 for accepted_position - 1)
        || prior_text
        || substring(review_md from accepted_position + length(accepted_text));
    end loop;
    review_position := position(proposal.selected_text in review_md);
    if review_position = 0 or position(
      proposal.selected_text in substring(review_md from review_position + length(proposal.selected_text))
    ) > 0 or
      right(substring(review_md from 1 for review_position - 1), length(proposal.prefix)) <> proposal.prefix
      or left(substring(review_md from review_position + length(proposal.selected_text)), length(proposal.suffix)) <> proposal.suffix
    then
      return query select 'conflict'::text, current_snapshot.revision;
      return;
    end if;
  end if;

  case proposal.proposal_action
    when 'replace' then
      updated_md := before_quote || proposal.suggested_text || after_quote;
    when 'delete' then
      updated_md := before_quote || after_quote;
    when 'insert_before' then
      updated_md := before_quote || proposal.suggested_text || proposal.selected_text || after_quote;
    when 'insert_after' then
      updated_md := before_quote || proposal.selected_text || proposal.suggested_text || after_quote;
  end case;
  changed_snapshot := jsonb_set(
    current_snapshot.snapshot,
    array['documents', article_index::text],
    jsonb_set(article, '{content}', to_jsonb(string_to_array(updated_md, E'\n')))
  );
  perform public.validate_desktop_snapshot_v3(3::smallint, changed_snapshot);
  update public.workspace_snapshots
    set snapshot = changed_snapshot, revision = current_snapshot.revision + 1
    where workspace_id = proposal.workspace_id;
  update public.knowledge_annotations
    set applied_at = now(), resolved_at = now(),
      prefix = right(before_quote, 96), suffix = left(after_quote, 96)
    where id = proposal.id;
  return query select 'applied'::text, current_snapshot.revision + 1;
end;
$$;
