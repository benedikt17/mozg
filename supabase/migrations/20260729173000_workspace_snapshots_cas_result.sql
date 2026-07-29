drop function public.save_workspace_snapshot(uuid, bigint, smallint, jsonb);

create function public.save_workspace_snapshot(
  target_workspace_id uuid,
  target_expected_revision bigint,
  target_schema_version smallint,
  target_snapshot jsonb
)
returns table (
  status text,
  revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_revision bigint;
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

  select snapshot_row.revision
    into current_revision
    from public.workspace_snapshots as snapshot_row
   where snapshot_row.workspace_id = target_workspace_id;

  if current_revision is null then
    raise exception using
      errcode = '42501',
      message = 'workspace snapshot unavailable';
  end if;

  return query
  update public.workspace_snapshots as current_snapshot
     set schema_version = target_schema_version,
         snapshot = target_snapshot,
         revision = current_snapshot.revision + 1
   where current_snapshot.workspace_id = target_workspace_id
     and current_snapshot.revision = target_expected_revision
  returning 'saved'::text, current_snapshot.revision;

  if found then
    return;
  end if;

  select snapshot_row.revision
    into current_revision
    from public.workspace_snapshots as snapshot_row
   where snapshot_row.workspace_id = target_workspace_id;

  if current_revision is null then
    raise exception using
      errcode = '42501',
      message = 'workspace snapshot unavailable';
  end if;

  return query select 'conflict'::text, current_revision;
end;
$$;

revoke all on function public.save_workspace_snapshot(uuid, bigint, smallint, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_workspace_snapshot(uuid, bigint, smallint, jsonb)
  to authenticated;
