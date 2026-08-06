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
  document_deleted_at timestamptz;
begin
  if target_schema_version is distinct from 1
     or target_snapshot is null
     or jsonb_typeof(target_snapshot) <> 'object'
     or jsonb_typeof(target_snapshot -> 'schemaVersion') <> 'number'
     or (target_snapshot ->> 'schemaVersion') !~ '^[0-9]+$'
     or (target_snapshot ->> 'schemaVersion')::integer <> 1 then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;

  perform public.assert_desktop_snapshot_v1_keys(target_snapshot, array['schemaVersion', 'projects', 'overviewDirections', 'taskGroups', 'taskLists', 'tasks', 'knowledgeFolders', 'documents'], array['schemaVersion', 'projects', 'overviewDirections', 'taskGroups', 'taskLists', 'tasks', 'knowledgeFolders', 'documents']);
  foreach item in array array[target_snapshot -> 'projects', target_snapshot -> 'overviewDirections', target_snapshot -> 'taskGroups', target_snapshot -> 'taskLists', target_snapshot -> 'tasks', target_snapshot -> 'knowledgeFolders', target_snapshot -> 'documents']
  loop
    if jsonb_typeof(item) <> 'array' then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
  end loop;

  for item in select value from jsonb_array_elements(target_snapshot -> 'projects') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'name', 'shortName', 'description'], array['id', 'name', 'shortName', 'description']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'name'); perform public.assert_desktop_snapshot_v1_string(item, 'shortName'); perform public.assert_desktop_snapshot_v1_string(item, 'description');
  end loop;
  for item in select value from jsonb_array_elements(target_snapshot -> 'overviewDirections') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'projectId', 'title', 'order'], array['id', 'projectId', 'title', 'order']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'projectId', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'title'); perform public.assert_desktop_snapshot_v1_order(item, 'order');
  end loop;
  for item in select value from jsonb_array_elements(target_snapshot -> 'taskGroups') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'projectId', 'title', 'order', 'kind'], array['id', 'projectId', 'title', 'order', 'kind']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'projectId', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'title'); perform public.assert_desktop_snapshot_v1_order(item, 'order');
    if item ->> 'kind' not in ('system', 'user') then raise exception using errcode = '22023', message = 'desktop snapshot validation failed'; end if;
  end loop;
  for item in select value from jsonb_array_elements(target_snapshot -> 'taskLists') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'projectId', 'groupId', 'title', 'order', 'kind', 'overviewDirectionId'], array['id', 'projectId', 'groupId', 'title', 'order', 'kind']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'projectId', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'groupId', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'title'); perform public.assert_desktop_snapshot_v1_order(item, 'order'); perform public.assert_desktop_snapshot_v1_string(item, 'overviewDirectionId', false, true);
    if item ->> 'kind' not in ('system', 'user') then raise exception using errcode = '22023', message = 'desktop snapshot validation failed'; end if;
  end loop;
  for item in select value from jsonb_array_elements(target_snapshot -> 'tasks') loop
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'projectId', 'title', 'overviewDirectionId', 'overviewOrder', 'taskListOrder', 'listId', 'showOnOverview', 'completedAt', 'signal', 'starred', 'myDay', 'area', 'dueDate', 'links', 'linkedDocumentIds', 'subtasks', 'notes'], array['id', 'projectId', 'title', 'overviewDirectionId', 'overviewOrder', 'taskListOrder', 'listId', 'showOnOverview', 'completedAt', 'signal', 'starred', 'myDay', 'links', 'linkedDocumentIds', 'subtasks']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'projectId', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'title'); perform public.assert_desktop_snapshot_v1_string(item, 'overviewDirectionId'); perform public.assert_desktop_snapshot_v1_order(item, 'overviewOrder'); perform public.assert_desktop_snapshot_v1_order(item, 'taskListOrder'); perform public.assert_desktop_snapshot_v1_string(item, 'listId', true, true);
    if jsonb_typeof(item -> 'showOnOverview') <> 'boolean' or jsonb_typeof(item -> 'starred') <> 'boolean' or jsonb_typeof(item -> 'myDay') <> 'boolean' or jsonb_typeof(item -> 'completedAt') not in ('string', 'null') or item ->> 'signal' not in ('none', 'green', 'yellow', 'red') then raise exception using errcode = '22023', message = 'desktop snapshot validation failed'; end if;
    perform public.assert_desktop_snapshot_v1_string(item, 'area', false); perform public.assert_desktop_snapshot_v1_string(item, 'dueDate', false); perform public.assert_desktop_snapshot_v1_string(item, 'notes', false); perform public.assert_desktop_snapshot_v1_string_array(item, 'linkedDocumentIds', true);
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
    perform public.assert_desktop_snapshot_v1_keys(item, array['id', 'projectId', 'order', 'folder', 'folderPath', 'isKeyDocument', 'title', 'excerpt', 'content', 'linkedTaskIds', 'backlinks', 'deletedAt'], array['id', 'projectId', 'folder', 'title', 'excerpt', 'content', 'linkedTaskIds', 'backlinks']);
    perform public.assert_desktop_snapshot_v1_string(item, 'id', true, true); perform public.assert_desktop_snapshot_v1_string(item, 'projectId', true, true); perform public.assert_desktop_snapshot_v1_order(item, 'order', false); perform public.assert_desktop_snapshot_v1_string(item, 'folder'); perform public.assert_desktop_snapshot_v1_string_array(item, 'folderPath', true, false, false); perform public.assert_desktop_snapshot_v1_string(item, 'title'); perform public.assert_desktop_snapshot_v1_string(item, 'excerpt'); perform public.assert_desktop_snapshot_v1_string_array(item, 'content'); perform public.assert_desktop_snapshot_v1_string_array(item, 'linkedTaskIds', true); perform public.assert_desktop_snapshot_v1_string_array(item, 'backlinks');
    if item ? 'isKeyDocument' and jsonb_typeof(item -> 'isKeyDocument') <> 'boolean' then raise exception using errcode = '22023', message = 'desktop snapshot validation failed'; end if;
    if item ? 'deletedAt' then
      if jsonb_typeof(item -> 'deletedAt') <> 'string'
         or btrim(item ->> 'deletedAt') = ''
         or (item ->> 'deletedAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
        raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
      end if;
      begin
        document_deleted_at := (item ->> 'deletedAt')::timestamptz;
      exception when others then
        raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
      end;
    end if;
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
    select 1 from jsonb_array_elements(target_snapshot -> 'taskLists') task_list
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
    where (
      exists (
        select 1 from jsonb_array_elements(target_snapshot -> 'taskLists') task_list
        where task_list ->> 'id' = task ->> 'listId'
          and task_list ->> 'projectId' = task ->> 'projectId'
          and task_list ->> 'kind' = 'system'
          and not exists (
            select 1 from jsonb_array_elements(target_snapshot -> 'overviewDirections') direction
            where direction ->> 'id' = task ->> 'overviewDirectionId'
              and direction ->> 'projectId' = task ->> 'projectId'
          )
      )
      or exists (
        select 1 from jsonb_array_elements(target_snapshot -> 'taskLists') task_list
        where task_list ->> 'id' = task ->> 'listId'
          and task_list ->> 'projectId' = task ->> 'projectId'
          and task_list ->> 'kind' = 'user'
          and (task ->> 'overviewDirectionId' <> '' or task ->> 'showOnOverview' <> 'false')
      )
      or (task ->> 'showOnOverview' = 'true' and not exists (
        select 1 from jsonb_array_elements(target_snapshot -> 'taskLists') task_list
        where task_list ->> 'id' = task ->> 'listId'
          and task_list ->> 'kind' = 'system'
          and task_list ->> 'overviewDirectionId' = task ->> 'overviewDirectionId'
      ))
    )
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
