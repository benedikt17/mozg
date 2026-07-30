create or replace function public.assert_desktop_snapshot_v1_keys(
  record_value jsonb,
  allowed_keys text[],
  required_keys text[]
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  field_name text;
begin
  if jsonb_typeof(record_value) <> 'object' then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;

  for field_name in select jsonb_object_keys(record_value)
  loop
    if not field_name = any(allowed_keys) then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
  end loop;

  foreach field_name in array required_keys
  loop
    if not record_value ? field_name then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
  end loop;
end;
$$;

create or replace function public.assert_desktop_snapshot_v1_string(
  record_value jsonb,
  field_name text,
  required_value boolean default true,
  non_empty boolean default false
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not record_value ? field_name then
    if required_value then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
    return;
  end if;
  if jsonb_typeof(record_value -> field_name) <> 'string'
     or (non_empty and btrim(record_value ->> field_name) = '') then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;
end;
$$;

create or replace function public.assert_desktop_snapshot_v1_order(
  record_value jsonb,
  field_name text,
  required_value boolean default true
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  order_value numeric;
begin
  if not record_value ? field_name then
    if required_value then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
    return;
  end if;
  if jsonb_typeof(record_value -> field_name) <> 'number' then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;
  order_value := (record_value ->> field_name)::numeric;
  if order_value < 0 or trunc(order_value) <> order_value then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;
end;
$$;

create or replace function public.assert_desktop_snapshot_v1_string_array(
  record_value jsonb,
  field_name text,
  non_empty_items boolean default false,
  non_empty_array boolean default false,
  required_value boolean default true
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  item jsonb;
begin
  if not record_value ? field_name then
    if required_value then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
    return;
  end if;
  if jsonb_typeof(record_value -> field_name) <> 'array'
     or (non_empty_array and jsonb_array_length(record_value -> field_name) = 0) then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;
  for item in select value from jsonb_array_elements(record_value -> field_name)
  loop
    if jsonb_typeof(item) <> 'string'
       or (non_empty_items and btrim(item #>> '{}') = '') then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
  end loop;
end;
$$;

create or replace function public.validate_desktop_snapshot_v1(
  target_schema_version smallint,
  target_snapshot jsonb
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  item jsonb;
  nested_item jsonb;
begin
  if target_schema_version is distinct from 1
     or target_snapshot is null
     or jsonb_typeof(target_snapshot) <> 'object'
     or jsonb_typeof(target_snapshot -> 'schemaVersion') <> 'number'
     or (target_snapshot ->> 'schemaVersion') !~ '^[0-9]+$'
     or (target_snapshot ->> 'schemaVersion')::integer <> 1 then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;

  perform public.assert_desktop_snapshot_v1_keys(
    target_snapshot,
    array['schemaVersion', 'projects', 'overviewDirections', 'taskGroups', 'taskLists', 'tasks', 'knowledgeFolders', 'documents'],
    array['schemaVersion', 'projects', 'overviewDirections', 'taskGroups', 'taskLists', 'tasks', 'knowledgeFolders', 'documents']
  );
  foreach item in array array[target_snapshot -> 'projects', target_snapshot -> 'overviewDirections', target_snapshot -> 'taskGroups', target_snapshot -> 'taskLists', target_snapshot -> 'tasks', target_snapshot -> 'knowledgeFolders', target_snapshot -> 'documents']
  loop
    if jsonb_typeof(item) <> 'array' then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
  end loop;

  for item in select value from jsonb_array_elements(target_snapshot -> 'projects') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'name', 'shortName', 'description'], array['id', 'name', 'shortName', 'description']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true);
    perform public.assert_desktop_snapshot_v1_string(item, 'name');
    perform public.assert_desktop_snapshot_v1_string(item, 'shortName');
    perform public.assert_desktop_snapshot_v1_string(item, 'description');
  end loop;
  for item in select value from jsonb_array_elements(target_snapshot -> 'overviewDirections') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'projectId', 'title', 'order'], array['id', 'projectId', 'title', 'order']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true);
    perform public.assert_desktop_snapshot_v1_string(item, 'projectId', true, true);
    perform public.assert_desktop_snapshot_v1_string(item, 'title');
    perform public.assert_desktop_snapshot_v1_order(item, 'order');
  end loop;
  for item in select value from jsonb_array_elements(target_snapshot -> 'taskGroups') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'projectId', 'title', 'order', 'kind'], array['id', 'projectId', 'title', 'order', 'kind']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true);
    perform public.assert_desktop_snapshot_v1_string(item, 'projectId', true, true);
    perform public.assert_desktop_snapshot_v1_string(item, 'title');
    perform public.assert_desktop_snapshot_v1_order(item, 'order');
    if item ->> 'kind' not in ('system', 'user') then raise exception using errcode = '22023', message = 'desktop snapshot validation failed'; end if;
  end loop;
  for item in select value from jsonb_array_elements(target_snapshot -> 'taskLists') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'projectId', 'groupId', 'title', 'order', 'kind', 'overviewDirectionId'], array['id', 'projectId', 'groupId', 'title', 'order', 'kind']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true);
    perform public.assert_desktop_snapshot_v1_string(item, 'projectId', true, true);
    perform public.assert_desktop_snapshot_v1_string(item, 'groupId', true, true);
    perform public.assert_desktop_snapshot_v1_string(item, 'title');
    perform public.assert_desktop_snapshot_v1_order(item, 'order');
    perform public.assert_desktop_snapshot_v1_string(item, 'overviewDirectionId', false, true);
    if item ->> 'kind' not in ('system', 'user') then raise exception using errcode = '22023', message = 'desktop snapshot validation failed'; end if;
  end loop;
  for item in select value from jsonb_array_elements(target_snapshot -> 'tasks') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'projectId', 'title', 'overviewDirectionId', 'overviewOrder', 'taskListOrder', 'listId', 'showOnOverview', 'completedAt', 'signal', 'starred', 'myDay', 'area', 'dueDate', 'links', 'linkedDocumentIds', 'subtasks', 'notes'], array['id', 'projectId', 'title', 'overviewDirectionId', 'overviewOrder', 'taskListOrder', 'listId', 'showOnOverview', 'completedAt', 'signal', 'starred', 'myDay', 'links', 'linkedDocumentIds', 'subtasks']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true);
    perform public.assert_desktop_snapshot_v1_string(item, 'projectId', true, true);
    perform public.assert_desktop_snapshot_v1_string(item, 'title');
    perform public.assert_desktop_snapshot_v1_string(item, 'overviewDirectionId');
    perform public.assert_desktop_snapshot_v1_order(item, 'overviewOrder');
    perform public.assert_desktop_snapshot_v1_order(item, 'taskListOrder');
    perform public.assert_desktop_snapshot_v1_string(item, 'listId', true, true);
    if jsonb_typeof(item -> 'showOnOverview') <> 'boolean' or jsonb_typeof(item -> 'starred') <> 'boolean' or jsonb_typeof(item -> 'myDay') <> 'boolean' or jsonb_typeof(item -> 'completedAt') not in ('string', 'null') or item ->> 'signal' not in ('none', 'green', 'yellow', 'red') then raise exception using errcode = '22023', message = 'desktop snapshot validation failed'; end if;
    perform public.assert_desktop_snapshot_v1_string(item, 'area', false);
    perform public.assert_desktop_snapshot_v1_string(item, 'dueDate', false);
    perform public.assert_desktop_snapshot_v1_string(item, 'notes', false);
    perform public.assert_desktop_snapshot_v1_string_array(item, 'linkedDocumentIds', true);
    if jsonb_typeof(item -> 'links') <> 'array' or jsonb_typeof(item -> 'subtasks') <> 'array' then raise exception using errcode = '22023', message = 'desktop snapshot validation failed'; end if;
    for nested_item in select value from jsonb_array_elements(item -> 'links') loop
      perform public.assert_desktop_snapshot_v1_keys(nested_item, array['id', 'title', 'url'], array['id', 'title', 'url']);
      perform public.assert_desktop_snapshot_v1_string(nested_item, 'id', true, true); perform public.assert_desktop_snapshot_v1_string(nested_item, 'title'); perform public.assert_desktop_snapshot_v1_string(nested_item, 'url');
    end loop;
    for nested_item in select value from jsonb_array_elements(item -> 'subtasks') loop
      perform public.assert_desktop_snapshot_v1_keys(nested_item, array['id', 'title', 'done'], array['id', 'title', 'done']);
      perform public.assert_desktop_snapshot_v1_string(nested_item, 'id', true, true); perform public.assert_desktop_snapshot_v1_string(nested_item, 'title');
      if jsonb_typeof(nested_item -> 'done') <> 'boolean' then raise exception using errcode = '22023', message = 'desktop snapshot validation failed'; end if;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(target_snapshot -> 'knowledgeFolders') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'projectId', 'path'], array['id', 'projectId', 'path']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'projectId', true, true); perform public.assert_desktop_snapshot_v1_string_array(item, 'path', true, true);
  end loop;
  for item in select value from jsonb_array_elements(target_snapshot -> 'documents') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'projectId', 'order', 'folder', 'folderPath', 'isKeyDocument', 'title', 'excerpt', 'content', 'linkedTaskIds', 'backlinks'], array['id', 'projectId', 'folder', 'title', 'excerpt', 'content', 'linkedTaskIds', 'backlinks']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'projectId', true, true); perform public.assert_desktop_snapshot_v1_order(item, 'order', false); perform public.assert_desktop_snapshot_v1_string(item, 'folder'); perform public.assert_desktop_snapshot_v1_string_array(item, 'folderPath', true, false, false); perform public.assert_desktop_snapshot_v1_string(item, 'title'); perform public.assert_desktop_snapshot_v1_string(item, 'excerpt'); perform public.assert_desktop_snapshot_v1_string_array(item, 'content'); perform public.assert_desktop_snapshot_v1_string_array(item, 'linkedTaskIds', true); perform public.assert_desktop_snapshot_v1_string_array(item, 'backlinks');
    if item ? 'isKeyDocument' and jsonb_typeof(item -> 'isKeyDocument') <> 'boolean' then raise exception using errcode = '22023', message = 'desktop snapshot validation failed'; end if;
  end loop;

  if exists (select 1 from jsonb_array_elements(target_snapshot -> 'projects') value group by value ->> 'id' having count(*) > 1)
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'overviewDirections') value group by value ->> 'id' having count(*) > 1)
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'taskGroups') value group by value ->> 'id' having count(*) > 1)
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'tasks') value group by value ->> 'id' having count(*) > 1)
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'documents') value group by value ->> 'id' having count(*) > 1)
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'taskLists') value group by value ->> 'id' having count(*) > 1)
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'knowledgeFolders') value group by value ->> 'id' having count(*) > 1) then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;
  if exists (select 1 from jsonb_array_elements(target_snapshot -> 'overviewDirections') direction where not exists (select 1 from jsonb_array_elements(target_snapshot -> 'projects') project where project ->> 'id' = direction ->> 'projectId'))
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'taskGroups') task_group where not exists (select 1 from jsonb_array_elements(target_snapshot -> 'projects') project where project ->> 'id' = task_group ->> 'projectId'))
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'knowledgeFolders') folder where not exists (select 1 from jsonb_array_elements(target_snapshot -> 'projects') project where project ->> 'id' = folder ->> 'projectId'))
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'tasks') task where not exists (select 1 from jsonb_array_elements(target_snapshot -> 'projects') project where project ->> 'id' = task ->> 'projectId'))
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'taskLists') list where not exists (select 1 from jsonb_array_elements(target_snapshot -> 'projects') project where project ->> 'id' = list ->> 'projectId'))
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'documents') document where not exists (select 1 from jsonb_array_elements(target_snapshot -> 'projects') project where project ->> 'id' = document ->> 'projectId'))
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'tasks') task where not exists (select 1 from jsonb_array_elements(target_snapshot -> 'taskLists') list where list ->> 'id' = task ->> 'listId' and list ->> 'projectId' = task ->> 'projectId'))
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'tasks') task cross join lateral jsonb_array_elements_text(task -> 'linkedDocumentIds') document_id where not exists (select 1 from jsonb_array_elements(target_snapshot -> 'documents') document where document ->> 'id' = document_id and document ->> 'projectId' = task ->> 'projectId'))
     or exists (select 1 from jsonb_array_elements(target_snapshot -> 'documents') document cross join lateral jsonb_array_elements_text(document -> 'linkedTaskIds') task_id where not exists (select 1 from jsonb_array_elements(target_snapshot -> 'tasks') task where task ->> 'id' = task_id and task ->> 'projectId' = document ->> 'projectId')) then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(target_snapshot -> 'taskLists') task_list
    where not exists (
      select 1 from jsonb_array_elements(target_snapshot -> 'taskGroups') task_group
      where task_group ->> 'id' = task_list ->> 'groupId'
        and task_group ->> 'projectId' = task_list ->> 'projectId'
        and task_group ->> 'kind' = task_list ->> 'kind'
    )
    or (task_list ->> 'kind' = 'system' and not exists (
      select 1 from jsonb_array_elements(target_snapshot -> 'overviewDirections') direction
      where direction ->> 'id' = task_list ->> 'overviewDirectionId'
        and direction ->> 'projectId' = task_list ->> 'projectId'
    ))
    or (task_list ->> 'kind' = 'user' and task_list ? 'overviewDirectionId')
  ) or exists (
    select 1
    from jsonb_array_elements(target_snapshot -> 'tasks') task
    where not exists (
      select 1 from jsonb_array_elements(target_snapshot -> 'overviewDirections') direction
      where direction ->> 'id' = task ->> 'overviewDirectionId'
        and direction ->> 'projectId' = task ->> 'projectId'
    )
    or (task ->> 'showOnOverview' = 'true' and not exists (
      select 1 from jsonb_array_elements(target_snapshot -> 'taskLists') task_list
      where task_list ->> 'id' = task ->> 'listId'
        and task_list ->> 'kind' = 'system'
        and task_list ->> 'overviewDirectionId' = task ->> 'overviewDirectionId'
    ))
  ) then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;
  for item in select value from jsonb_array_elements(target_snapshot -> 'tasks') loop
    if exists (select 1 from jsonb_array_elements(item -> 'links') value group by value ->> 'id' having count(*) > 1)
       or exists (select 1 from jsonb_array_elements(item -> 'subtasks') value group by value ->> 'id' having count(*) > 1) then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
  end loop;
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
begin
  if target_expected_revision is null or target_expected_revision <= 0 then
    raise exception using errcode = '22023', message = 'expected revision must be positive';
  end if;
  if not public.has_workspace_role(target_workspace_id, array['owner']) then
    raise exception using errcode = '42501', message = 'workspace access denied';
  end if;
  perform public.validate_desktop_snapshot_v1(target_schema_version, target_snapshot);

  return query update public.workspace_snapshots as current_snapshot
    set schema_version = target_schema_version, snapshot = target_snapshot, revision = current_snapshot.revision + 1
    where current_snapshot.workspace_id = target_workspace_id and current_snapshot.revision = target_expected_revision
    returning 'saved'::text, current_snapshot.revision;
  if found then return; end if;
  select snapshot_row.revision into revision from public.workspace_snapshots as snapshot_row where snapshot_row.workspace_id = target_workspace_id;
  if revision is null then raise exception using errcode = '42501', message = 'workspace snapshot unavailable'; end if;
  return query select 'conflict'::text, revision;
end;
$$;

revoke all on function public.assert_desktop_snapshot_v1_keys(jsonb, text[], text[]) from public, anon, authenticated;
revoke all on function public.assert_desktop_snapshot_v1_string(jsonb, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.assert_desktop_snapshot_v1_order(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.assert_desktop_snapshot_v1_string_array(jsonb, text, boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function public.validate_desktop_snapshot_v1(smallint, jsonb) from public, anon, authenticated;
revoke all on function public.save_workspace_snapshot(uuid, bigint, smallint, jsonb) from public, anon, authenticated;
grant execute on function public.save_workspace_snapshot(uuid, bigint, smallint, jsonb) to authenticated;

revoke insert on table public.workspace_snapshots from authenticated;
