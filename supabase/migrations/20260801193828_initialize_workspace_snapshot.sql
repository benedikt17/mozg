create function public.initialize_workspace_snapshot(
  target_workspace_id uuid,
  target_schema_version smallint,
  target_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner']) then
    raise exception using errcode = '42501', message = 'workspace access denied';
  end if;
  if target_schema_version <> 2 then
    raise exception using errcode = '22023', message = 'desktop snapshot schema version is not supported';
  end if;

  perform public.validate_desktop_snapshot_v2(
    target_schema_version,
    target_snapshot
  );

  insert into public.workspace_snapshots (
    workspace_id,
    schema_version,
    snapshot,
    revision
  )
  values (
    target_workspace_id,
    target_schema_version,
    target_snapshot,
    1
  )
  on conflict (workspace_id) do nothing;
end;
$$;

revoke all on function public.initialize_workspace_snapshot(uuid, smallint, jsonb)
from public, anon, authenticated;
grant execute on function public.initialize_workspace_snapshot(uuid, smallint, jsonb)
to authenticated;
