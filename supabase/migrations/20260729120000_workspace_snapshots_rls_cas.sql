create table public.workspace_snapshots (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  schema_version smallint not null default 1 check (schema_version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspace_snapshots_set_updated_at
before update on public.workspace_snapshots
for each row execute function public.set_updated_at();

create trigger workspace_snapshots_guard_workspace_id
before update on public.workspace_snapshots
for each row execute function public.guard_workspace_id();

alter table public.workspace_snapshots enable row level security;

create policy workspace_snapshots_select_member
on public.workspace_snapshots
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy workspace_snapshots_insert_owner
on public.workspace_snapshots
for insert
to authenticated
with check (public.has_workspace_role(workspace_id, array['owner']));

create policy workspace_snapshots_update_owner
on public.workspace_snapshots
for update
to authenticated
using (public.has_workspace_role(workspace_id, array['owner']))
with check (public.has_workspace_role(workspace_id, array['owner']));

revoke all on table public.workspace_snapshots from public, anon, authenticated;
grant select on table public.workspace_snapshots to anon, authenticated;
grant insert on table public.workspace_snapshots to authenticated;

create function public.save_workspace_snapshot(
  target_workspace_id uuid,
  target_expected_revision bigint,
  target_schema_version smallint,
  target_snapshot jsonb
)
returns table (
  new_revision bigint,
  new_updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if target_expected_revision is null or target_expected_revision <= 0 then
    raise exception using
      errcode = '22023',
      message = 'expected revision must be positive';
  end if;

  if target_schema_version is null or target_schema_version <= 0 then
    raise exception using
      errcode = '22023',
      message = 'schema version must be positive';
  end if;

  if target_snapshot is null or jsonb_typeof(target_snapshot) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'snapshot must be a JSON object';
  end if;

  if not public.has_workspace_role(target_workspace_id, array['owner']) then
    raise exception using
      errcode = '42501',
      message = 'workspace access denied';
  end if;

  return query
  update public.workspace_snapshots as current_snapshot
  set schema_version = target_schema_version,
      snapshot = target_snapshot,
      revision = current_snapshot.revision + 1
  where current_snapshot.workspace_id = target_workspace_id
    and current_snapshot.revision = target_expected_revision
  returning current_snapshot.revision, current_snapshot.updated_at;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'snapshot revision conflict';
  end if;
end;
$$;

revoke all on function public.save_workspace_snapshot(uuid, bigint, smallint, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_workspace_snapshot(uuid, bigint, smallint, jsonb)
  to authenticated;
