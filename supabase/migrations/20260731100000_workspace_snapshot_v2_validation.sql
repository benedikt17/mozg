create or replace function public.validate_desktop_snapshot_v2(
  target_schema_version smallint,
  target_snapshot jsonb
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  task_item jsonb;
  subtask_item jsonb;
  tasks_v1 jsonb;
  v1_snapshot jsonb;
begin
  if target_schema_version is distinct from 2
     or target_snapshot is null
     or jsonb_typeof(target_snapshot) <> 'object'
     or jsonb_typeof(target_snapshot -> 'schemaVersion') <> 'number'
     or (target_snapshot ->> 'schemaVersion') !~ '^2$'
     or jsonb_typeof(target_snapshot -> 'tasks') <> 'array' then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;

  perform public.assert_desktop_snapshot_v1_keys(
    target_snapshot,
    array['schemaVersion', 'projects', 'overviewDirections', 'taskGroups', 'taskLists', 'tasks', 'knowledgeFolders', 'documents'],
    array['schemaVersion', 'projects', 'overviewDirections', 'taskGroups', 'taskLists', 'tasks', 'knowledgeFolders', 'documents']
  );

  for task_item in select value from jsonb_array_elements(target_snapshot -> 'tasks')
  loop
    if jsonb_typeof(task_item) <> 'object'
       or jsonb_typeof(task_item -> 'subtasks') <> 'array' then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
    for subtask_item in select value from jsonb_array_elements(task_item -> 'subtasks')
    loop
      perform public.assert_desktop_snapshot_v1_keys(
        subtask_item,
        array['id', 'title', 'done', 'detailsMarkdown'],
        array['id', 'title', 'done', 'detailsMarkdown']
      );
      perform public.assert_desktop_snapshot_v1_string(subtask_item, 'id', true, true);
      perform public.assert_desktop_snapshot_v1_string(subtask_item, 'title');
      perform public.assert_desktop_snapshot_v1_string(subtask_item, 'detailsMarkdown');
      if jsonb_typeof(subtask_item -> 'done') <> 'boolean' then
        raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
      end if;
    end loop;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_set(
        task_row.value,
        '{subtasks}',
        coalesce(
          (
            select jsonb_agg(
              subtask_row.value - 'detailsMarkdown'
              order by subtask_row.ordinality
            )
            from jsonb_array_elements(task_row.value -> 'subtasks')
              with ordinality as subtask_row(value, ordinality)
          ),
          '[]'::jsonb
        ),
        false
      )
      order by task_row.ordinality
    ),
    '[]'::jsonb
  )
  into tasks_v1
  from jsonb_array_elements(target_snapshot -> 'tasks')
    with ordinality as task_row(value, ordinality);

  v1_snapshot := jsonb_set(
    jsonb_set(target_snapshot, '{schemaVersion}', '1'::jsonb, false),
    '{tasks}',
    tasks_v1,
    false
  );
  perform public.validate_desktop_snapshot_v1(1::smallint, v1_snapshot);
end;
$$;

create or replace function public.save_workspace_snapshot(
  target_workspace_id uuid,
  target_expected_revision bigint,
  target_schema_version smallint,
  target_snapshot jsonb
)
returns table (status text, revision bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_revision bigint;
  current_schema_version smallint;
  payload_schema_version integer;
begin
  if target_expected_revision is null or target_expected_revision <= 0 then
    raise exception using errcode = '22023', message = 'expected revision must be positive';
  end if;
  if not public.has_workspace_role(target_workspace_id, array['owner']) then
    raise exception using errcode = '42501', message = 'workspace access denied';
  end if;
  if target_schema_version not in (1, 2) then
    raise exception using errcode = '22023', message = 'desktop snapshot schema version is not supported';
  end if;
  if target_snapshot is null
     or jsonb_typeof(target_snapshot) <> 'object'
     or jsonb_typeof(target_snapshot -> 'schemaVersion') <> 'number'
     or (target_snapshot ->> 'schemaVersion') !~ '^[0-9]+$' then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;
  payload_schema_version := (target_snapshot ->> 'schemaVersion')::integer;
  if payload_schema_version <> target_schema_version then
    raise exception using errcode = '22023', message = 'desktop snapshot schema version mismatch';
  end if;

  select snapshot_row.revision, snapshot_row.schema_version
    into current_revision, current_schema_version
    from public.workspace_snapshots as snapshot_row
    where snapshot_row.workspace_id = target_workspace_id;
  if current_revision is null then
    raise exception using errcode = '42501', message = 'workspace snapshot unavailable';
  end if;
  if target_schema_version < current_schema_version then
    raise exception using errcode = '22023', message = 'desktop snapshot schema downgrade is not supported';
  end if;

  if target_schema_version = 1 then
    perform public.validate_desktop_snapshot_v1(target_schema_version, target_snapshot);
  else
    perform public.validate_desktop_snapshot_v2(target_schema_version, target_snapshot);
  end if;

  return query update public.workspace_snapshots as current_snapshot
    set schema_version = target_schema_version,
        snapshot = target_snapshot,
        revision = current_snapshot.revision + 1
    where current_snapshot.workspace_id = target_workspace_id
      and current_snapshot.revision = target_expected_revision
    returning 'saved'::text, current_snapshot.revision;
  if found then return; end if;

  select snapshot_row.revision into revision
    from public.workspace_snapshots as snapshot_row
    where snapshot_row.workspace_id = target_workspace_id;
  if revision is null then
    raise exception using errcode = '42501', message = 'workspace snapshot unavailable';
  end if;
  return query select 'conflict'::text, revision;
end;
$$;

revoke all on function public.validate_desktop_snapshot_v2(smallint, jsonb) from public, anon, authenticated;
revoke all on function public.save_workspace_snapshot(uuid, bigint, smallint, jsonb) from public, anon, authenticated;
grant execute on function public.save_workspace_snapshot(uuid, bigint, smallint, jsonb) to authenticated;
