create table public.knowledge_annotations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id text not null check (length(btrim(document_id)) > 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  schema_version smallint not null default 1 check (schema_version = 1),
  selected_text text not null check (
    length(btrim(selected_text)) > 0
    and length(selected_text) <= 20000
  ),
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset >= start_offset),
  prefix text not null default '' check (length(prefix) <= 96),
  suffix text not null default '' check (length(suffix) <= 96),
  comment text not null check (
    length(btrim(comment)) > 0
    and length(comment) <= 10000
  ),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_annotations_document_idx
  on public.knowledge_annotations (
    workspace_id,
    document_id,
    created_by,
    created_at
  );

create index knowledge_annotations_open_idx
  on public.knowledge_annotations (
    workspace_id,
    document_id,
    created_by,
    resolved_at
  );

create trigger knowledge_annotations_set_updated_at
before update on public.knowledge_annotations
for each row execute function public.set_updated_at();

create function public.guard_knowledge_annotation_identity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.workspace_id <> old.workspace_id
    or new.document_id <> old.document_id
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception using
      errcode = '23514',
      message = 'knowledge annotation identity cannot be changed';
  end if;

  return new;
end;
$$;

create trigger knowledge_annotations_guard_identity
before update on public.knowledge_annotations
for each row execute function public.guard_knowledge_annotation_identity();

alter table public.knowledge_annotations enable row level security;

create policy knowledge_annotations_select_own
on public.knowledge_annotations
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy knowledge_annotations_insert_editor
on public.knowledge_annotations
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, array['owner', 'editor'])
  and created_by = (select auth.uid())
);

create policy knowledge_annotations_update_own_editor
on public.knowledge_annotations
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
)
with check (
  public.has_workspace_role(workspace_id, array['owner', 'editor'])
  and created_by = (select auth.uid())
);

revoke all on table public.knowledge_annotations from anon, authenticated;
grant select, insert, update on table public.knowledge_annotations to authenticated;

revoke all on function public.guard_knowledge_annotation_identity() from public;
