-- Files Search: Project-scoped full-text index for extracted document content.
--
-- Originals remain immutable in private Storage. Search chunks are disposable,
-- rebuildable derivatives keyed by the durable project_files.id identity.
-- Chunking keeps each tsvector comfortably below PostgreSQL FTS size/position
-- limits and preserves phrase search throughout long documents.

create table public.project_file_search_chunks (
  workspace_id uuid not null,
  project_id text not null,
  file_id uuid not null,
  chunk_index integer not null,
  extracted_text text not null default '',
  extractor_version integer not null default 1,
  indexed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_tsv tsvector generated always as (
    setweight(
      to_tsvector('russian'::regconfig, coalesce(extracted_text, '')),
      'A'
    )
    || setweight(
      to_tsvector('simple'::regconfig, coalesce(extracted_text, '')),
      'A'
    )
  ) stored,
  primary key (workspace_id, project_id, file_id, chunk_index),
  constraint project_file_search_chunks_parent_fkey
    foreign key (workspace_id, project_id, file_id)
    references public.project_files(workspace_id, project_id, id)
    on delete cascade,
  constraint project_file_search_chunks_project_id_check
    check (project_id = btrim(project_id) and length(project_id) between 1 and 128),
  constraint project_file_search_chunks_chunk_index_check
    check (chunk_index between 0 and 511),
  constraint project_file_search_chunks_text_size_check
    check (octet_length(extracted_text) <= 24576),
  constraint project_file_search_chunks_extractor_version_check
    check (extractor_version between 1 and 1000000)
);

create index project_file_search_chunks_tsv_gin
  on public.project_file_search_chunks using gin(search_tsv);

create index project_file_search_chunks_parent_idx
  on public.project_file_search_chunks(workspace_id, project_id, file_id);

create trigger project_file_search_chunks_set_updated_at
before update on public.project_file_search_chunks
for each row execute function public.set_updated_at();

alter table public.project_file_search_chunks enable row level security;

create policy project_file_search_chunks_select_member
on public.project_file_search_chunks
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.project_files as file_row
    where file_row.workspace_id = project_file_search_chunks.workspace_id
      and file_row.project_id = project_file_search_chunks.project_id
      and file_row.id = project_file_search_chunks.file_id
      and file_row.ready_at is not null
      and file_row.deleted_at is null
  )
);

revoke all on table public.project_file_search_chunks
  from public, anon, authenticated;
grant select on table public.project_file_search_chunks to authenticated;

create function public.upsert_project_file_search_content(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid,
  target_chunks text[],
  target_extractor_version integer default 1
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if target_chunks is null
     or cardinality(target_chunks) < 1
     or cardinality(target_chunks) > 512
     or exists (
       select 1
       from unnest(target_chunks) as chunk(value)
       where value is null or octet_length(value) > 24576
     )
     or target_extractor_version is null
     or target_extractor_version < 1
     or target_extractor_version > 1000000 then
    raise exception using errcode = '22023', message = 'Project file search content is invalid';
  end if;

  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not exists (
       select 1
       from public.project_files as file_row
       where file_row.workspace_id = target_workspace_id
         and file_row.project_id = target_project_id
         and file_row.id = target_file_id
         and file_row.ready_at is not null
         and file_row.deleted_at is null
         and file_row.mime_type in (
           'application/pdf',
           'text/plain',
           'text/markdown',
           'application/json',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           'application/vnd.openxmlformats-officedocument.presentationml.presentation'
         )
     ) then
    raise exception using errcode = '42501', message = 'Project file search content access denied';
  end if;

  delete from public.project_file_search_chunks
  where workspace_id = target_workspace_id
    and project_id = target_project_id
    and file_id = target_file_id;

  insert into public.project_file_search_chunks (
    workspace_id,
    project_id,
    file_id,
    chunk_index,
    extracted_text,
    extractor_version,
    indexed_at
  )
  select
    target_workspace_id,
    target_project_id,
    target_file_id,
    (chunk.ordinality - 1)::integer,
    chunk.value,
    target_extractor_version,
    now()
  from unnest(target_chunks) with ordinality as chunk(value, ordinality);
end;
$$;

create function public.list_project_files_needing_search_content(
  target_workspace_id uuid,
  target_project_id text,
  target_extractor_version integer default 1,
  target_limit integer default 24
)
returns setof public.project_files
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project file search content access denied';
  end if;

  if target_extractor_version is null
     or target_extractor_version < 1
     or target_extractor_version > 1000000
     or target_limit is null
     or target_limit < 1
     or target_limit > 100 then
    raise exception using errcode = '22023', message = 'Project file search request is invalid';
  end if;

  return query
  select file_row.*
  from public.project_files as file_row
  where file_row.workspace_id = target_workspace_id
    and file_row.project_id = target_project_id
    and file_row.ready_at is not null
    and file_row.deleted_at is null
    and file_row.mime_type in (
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/json',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
    and not exists (
      select 1
      from public.project_file_search_chunks as chunk_row
      where chunk_row.workspace_id = file_row.workspace_id
        and chunk_row.project_id = file_row.project_id
        and chunk_row.file_id = file_row.id
        and chunk_row.extractor_version = target_extractor_version
    )
  order by file_row.created_at asc
  limit target_limit;
end;
$$;

create function public.search_project_files(
  target_workspace_id uuid,
  target_project_id text,
  target_query text,
  target_limit integer default 200
)
returns setof public.project_files
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_query text;
  russian_query tsquery;
  simple_query tsquery;
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception using errcode = '42501', message = 'Project file search access denied';
  end if;

  normalized_query := btrim(coalesce(target_query, ''));
  if normalized_query = '' then
    return;
  end if;

  if target_limit is null or target_limit < 1 or target_limit > 500 then
    raise exception using errcode = '22023', message = 'Project file search limit is invalid';
  end if;

  russian_query := websearch_to_tsquery('russian'::regconfig, normalized_query);
  simple_query := websearch_to_tsquery('simple'::regconfig, normalized_query);

  return query
  with content_matches as (
    select
      chunk_row.file_id,
      max(greatest(
        ts_rank_cd(chunk_row.search_tsv, russian_query),
        ts_rank_cd(chunk_row.search_tsv, simple_query)
      )) as rank
    from public.project_file_search_chunks as chunk_row
    where chunk_row.workspace_id = target_workspace_id
      and chunk_row.project_id = target_project_id
      and (
        chunk_row.search_tsv @@ russian_query
        or chunk_row.search_tsv @@ simple_query
      )
    group by chunk_row.file_id
  )
  select file_row.*
  from public.project_files as file_row
  left join content_matches
    on content_matches.file_id = file_row.id
  where file_row.workspace_id = target_workspace_id
    and file_row.project_id = target_project_id
    and file_row.ready_at is not null
    and file_row.deleted_at is null
    and (
      file_row.search_tsv @@ russian_query
      or file_row.search_tsv @@ simple_query
      or content_matches.file_id is not null
    )
  order by greatest(
      ts_rank_cd(file_row.search_tsv, russian_query),
      ts_rank_cd(file_row.search_tsv, simple_query),
      coalesce(content_matches.rank, 0)
    ) desc,
    file_row.updated_at desc,
    file_row.id
  limit target_limit;
end;
$$;

revoke all on function public.upsert_project_file_search_content(uuid, text, uuid, text[], integer)
  from public, anon, authenticated;
revoke all on function public.list_project_files_needing_search_content(uuid, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.search_project_files(uuid, text, text, integer)
  from public, anon, authenticated;

grant execute on function public.upsert_project_file_search_content(uuid, text, uuid, text[], integer)
  to authenticated;
grant execute on function public.list_project_files_needing_search_content(uuid, text, integer, integer)
  to authenticated;
grant execute on function public.search_project_files(uuid, text, text, integer)
  to authenticated;
