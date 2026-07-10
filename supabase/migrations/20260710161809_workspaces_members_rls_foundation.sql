create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx
  on public.workspace_members (user_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

create function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
  );
$$;

create function public.has_workspace_role(
  target_workspace_id uuid,
  roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and role = any(roles)
  );
$$;

create function public.guard_workspace_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and new.workspace_id <> old.workspace_id then
    raise exception using
      errcode = '23514',
      message = 'workspace_id of a membership cannot be changed';
  end if;

  if old.role = 'owner'
    and (tg_op = 'DELETE' or new.role <> 'owner') then
    perform 1
    from public.workspaces
    where id = old.workspace_id
    for update;

    if not found then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    if not exists (
      select 1
      from public.workspace_members
      where workspace_id = old.workspace_id
        and user_id <> old.user_id
        and role = 'owner'
    ) then
      raise exception using
        errcode = '23514',
        message = 'the last workspace owner cannot be removed or demoted';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger workspace_members_guard
before update or delete on public.workspace_members
for each row execute function public.guard_workspace_membership();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy workspaces_select_member
on public.workspaces
for select
to anon, authenticated
using (public.is_workspace_member(id));

create policy workspaces_update_owner
on public.workspaces
for update
to authenticated
using (public.is_workspace_member(id))
with check (public.has_workspace_role(id, array['owner']));

create policy workspaces_delete_owner
on public.workspaces
for delete
to authenticated
using (public.has_workspace_role(id, array['owner']));

create policy workspace_members_select_member
on public.workspace_members
for select
to anon, authenticated
using (public.is_workspace_member(workspace_id));

create policy workspace_members_insert_owner
on public.workspace_members
for insert
to authenticated
with check (public.has_workspace_role(workspace_id, array['owner']));

create policy workspace_members_update_owner
on public.workspace_members
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.has_workspace_role(workspace_id, array['owner']));

create policy workspace_members_delete_owner
on public.workspace_members
for delete
to authenticated
using (public.has_workspace_role(workspace_id, array['owner']));

revoke all on table public.workspaces from anon, authenticated;
revoke all on table public.workspace_members from anon, authenticated;

grant select on table public.workspaces to anon, authenticated;
grant update, delete on table public.workspaces to authenticated;
grant select on table public.workspace_members to anon, authenticated;
grant insert, update, delete on table public.workspace_members to authenticated;

revoke all on function public.set_updated_at() from public;
revoke all on function public.guard_workspace_membership() from public;
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid, text[]) from public;

grant execute on function public.is_workspace_member(uuid) to anon, authenticated;
grant execute on function public.has_workspace_role(uuid, text[]) to anon, authenticated;
