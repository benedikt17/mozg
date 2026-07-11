create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  name text not null,
  emoji text,
  color text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  title text not null,
  content_md text not null default '',
  is_daily boolean not null default false,
  daily_date date,
  version bigint not null default 1,
  archived_at timestamptz,
  share_token uuid,
  search_tsv tsvector generated always as (
    setweight(
      to_tsvector('russian', coalesce(title, '')),
      'A'
    )
    ||
    setweight(
      to_tsvector('russian', coalesce(content_md, '')),
      'B'
    )
    ||
    setweight(
      to_tsvector('simple', coalesce(title, '')),
      'A'
    )
    ||
    setweight(
      to_tsvector('simple', coalesce(content_md, '')),
      'B'
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  check (
    (is_daily = true and daily_date is not null)
    or
    (is_daily = false and daily_date is null)
  )
);

create unique index notes_project_title_unique
  on public.notes (project_id, lower(btrim(title)))
  where archived_at is null;

create unique index notes_daily_unique
  on public.notes (project_id, daily_date)
  where is_daily = true and archived_at is null;

create unique index notes_share_token_unique
  on public.notes (share_token)
  where share_token is not null;

create index notes_search_tsv_gin
  on public.notes using gin (search_tsv);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

create function public.guard_workspace_id()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.workspace_id <> old.workspace_id then
    raise exception using
      errcode = '23514',
      message = 'workspace_id cannot be changed';
  end if;

  return new;
end;
$$;

create function public.guard_note_share_token()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.share_token is distinct from old.share_token
    and current_user in ('anon', 'authenticated') then
    raise exception using
      errcode = '42501',
      message = 'share_token can only be changed by a trusted server operation';
  end if;

  return new;
end;
$$;

create trigger projects_guard_workspace_id
before update on public.projects
for each row execute function public.guard_workspace_id();

create trigger notes_guard_workspace_id
before update on public.notes
for each row execute function public.guard_workspace_id();

create trigger notes_guard_share_token
before update on public.notes
for each row execute function public.guard_note_share_token();

alter table public.projects enable row level security;
alter table public.notes enable row level security;

create policy projects_select_member
on public.projects
for select
to anon, authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    archived_at is null
    or public.has_workspace_role(workspace_id, array['owner'])
  )
);

create policy projects_insert_editor
on public.projects
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, array['owner', 'editor'])
);

create policy projects_update_editor
on public.projects
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    archived_at is null
    or public.has_workspace_role(workspace_id, array['owner'])
  )
)
with check (
  public.has_workspace_role(workspace_id, array['owner', 'editor'])
);

create policy notes_select_member
on public.notes
for select
to anon, authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    archived_at is null
    or public.has_workspace_role(workspace_id, array['owner'])
  )
);

create policy notes_insert_editor
on public.notes
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, array['owner', 'editor'])
  and share_token is null
);

create policy notes_update_editor
on public.notes
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    archived_at is null
    or public.has_workspace_role(workspace_id, array['owner'])
  )
)
with check (
  public.has_workspace_role(workspace_id, array['owner', 'editor'])
);

revoke all on table public.projects from anon, authenticated;
revoke all on table public.notes from anon, authenticated;

grant select on table public.projects to anon, authenticated;
grant insert, update on table public.projects to authenticated;
grant select on table public.notes to anon, authenticated;
grant insert, update on table public.notes to authenticated;

revoke all on function public.guard_workspace_id() from public;
revoke all on function public.guard_note_share_token() from public;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.bootstrap_user_workspace(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  bootstrap_workspace_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_user_id::text, 0)
  );

  select workspace_id
  into bootstrap_workspace_id
  from public.workspace_members
  where user_id = target_user_id
  order by created_at, workspace_id
  limit 1;

  if bootstrap_workspace_id is not null then
    return bootstrap_workspace_id;
  end if;

  insert into public.workspaces (name)
  values ('Личное пространство')
  returning id into bootstrap_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (bootstrap_workspace_id, target_user_id, 'owner');

  return bootstrap_workspace_id;
end;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform private.bootstrap_user_workspace(new.id);
  return new;
end;
$$;

revoke all on function private.bootstrap_user_workspace(uuid)
  from public, anon, authenticated;
revoke all on function private.handle_new_user()
  from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
