-- Files Search: Project-scoped full-text index for extracted document content.
--
-- Originals remain immutable in private Storage. Extracted text is a disposable,
-- rebuildable derivative keyed by the durable project_files.id identity.

create table public.project_file_search_content (
  workspace_id uuid not null,
  project_id text not null,
  file_id uuid not null,
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
  primary key (workspace_id, project_id, file_id),
  constraint project_file_search_content_parent_fkey
    foreign key (workspace_id, project_id, file_id)
    references public.project_files(workspace_id, project_id, id)
    on delete cascade,
  constraint project_file_search_content_project_id_check
    check (project_id = btrim(project_id) and length(project_id) between 1 and 128),
  constraint project_file_search_content_text_size_check
    check (octet_length(extracted_text) <= 4194304),
  constraint project_file_search_content_extractor_version_check
    check (extractor_version between 1 and 1000000)
);

create index project_file_search_content_tsv_gin
  on public.project_file_search_content using gin(search_tsv);

create index project_file_search_content_parent_idx
  on public.project_file_search_content(workspace_id, project_id, file_id);

create trigger project_file_search_content_set_updated_at
before update on public.project_file_search_content
for each row execute function public.set_updated_at();

alter table public.project_file_search_content enable row level security;

create policy project_file_search_content_select_member
on public.project_file_search_content
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.project_files as file_row
    where file_row.workspace_id = project_file_search_content.workspace_id
      and file_row.project_id = project_file_search_content.project_id
      and file_row.id = project_file_search_content.file_id
      and file_row.ready_at is not null
      and file_row.deleted_at is null
  )
);

revoke all on table public.project_file_search_content
  from public, anon, authenticated;
grant select on table public.project_file_search_content to authenticated;

create function public.upsert_project_file_search_content(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid,
  target_extracted_text text,
  target_extractor_version integer default 1
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if target_extracted_text is null
     or octet_length(target_extracted_text) > 4194304
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

  insert into public.project_file_search_content (
    workspace_id,
    project_id,
    file_id,
    extracted_text,
    extractor_version,
    indexed_at
  )
  values (
    target_workspace_id,
    target_project_id,
    target_file_id,
    target_extracted_text,
    target_extractor_version,
    now()
  )
  on conflict (workspace_id, project_id, file_id)
  do update
    set extracted_text = excluded.extracted_text,
        extractor_version = excluded.extractor_version,
        indexed_at = now();
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
  if not public.is_workspace_member(target_workspace_id) then
    raise exception using errcode = '42501', message = 'Project file search access denied';
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
  left join public.project_file_search_content as content_row
    on content_row.workspace_id = file_row.workspace_id
   and content_row.project_id = file_row.project_id
   and content_row.file_id = file_row.id
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
    and (
      content_row.file_id is null
      or content_row.extractor_version < target_extractor_version
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
  select file_row.*
  from public.project_files as file_row
  left join public.project_file_search_content as content_row
    on content_row.workspace_id = file_row.workspace_id
   and content_row.project_id = file_row.project_id
   and content_row.file_id = file_row.id
  where file_row.workspace_id = target_workspace_id
    and file_row.project_id = target_project_id
    and file_row.ready_at is not null
    and file_row.deleted_at is null
    and (
      file_row.search_tsv @@ russian_query
      or file_row.search_tsv @@ simple_query
      or content_row.search_tsv @@ russian_query
      or content_row.search_tsv @@ simple_query
    )
  order by greatest(
      ts_rank_cd(file_row.search_tsv, russian_query),
      ts_rank_cd(file_row.search_tsv, simple_query),
      coalesce(ts_rank_cd(content_row.search_tsv, russian_query), 0),
      coalesce(ts_rank_cd(content_row.search_tsv, simple_query), 0)
    ) desc,
    file_row.updated_at desc,
    file_row.id
  limit target_limit;
end;
$$;

revoke all on function public.upsert_project_file_search_content(uuid, text, uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.list_project_files_needing_search_content(uuid, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.search_project_files(uuid, text, text, integer)
  from public, anon, authenticated;

grant execute on function public.upsert_project_file_search_content(uuid, text, uuid, text, integer)
  to authenticated;
grant execute on function public.list_project_files_needing_search_content(uuid, text, integer, integer)
  to authenticated;
grant execute on function public.search_project_files(uuid, text, text, integer)
  to authenticated;
