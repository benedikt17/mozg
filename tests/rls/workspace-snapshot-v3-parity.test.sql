begin;

select no_plan();

create function pg_temp.valid_desktop_snapshot_v3()
returns jsonb
language sql
immutable
as $$
  select '{"schemaVersion":3,"projects":[{"id":"project-1","name":"","shortName":"","description":""}],"overviewDirections":[{"id":"direction-1","projectId":"project-1","title":"","order":0}],"taskGroups":[{"id":"group-1","projectId":"project-1","title":"","order":0,"kind":"system"}],"taskLists":[{"id":"list-1","projectId":"project-1","groupId":"group-1","title":"","order":0,"kind":"system","overviewDirectionId":"direction-1"}],"tasks":[{"id":"task-1","projectId":"project-1","title":"","overviewDirectionId":"direction-1","overviewOrder":0,"taskListOrder":0,"listId":"list-1","showOnOverview":false,"completedAt":null,"signal":"none","starred":false,"myDay":false,"links":[],"linkedDocumentIds":["document-1"],"subtasks":[]}],"knowledgeFolders":[{"id":"project-1:Folder","projectId":"project-1","path":["Folder"]}],"documents":[{"id":"document-1","projectId":"project-1","folder":"","folderPath":[],"title":"","excerpt":"","content":[],"backlinks":[]}]}'::jsonb
$$;

select lives_ok(
  $$ select public.validate_desktop_snapshot_v3(3::smallint, pg_temp.valid_desktop_snapshot_v3()) $$,
  'baseline V3 fixture remains valid'
);

select throws_ok(
  $$ select public.validate_desktop_snapshot_v3(3::smallint, jsonb_set(pg_temp.valid_desktop_snapshot_v3(), '{projects,0,id}', to_jsonb(E'\t'::text))) $$,
  '22023',
  'desktop snapshot validation failed',
  'V3 rejects a tab-only required identifier'
);

select throws_ok(
  $$ select public.validate_desktop_snapshot_v3(3::smallint, jsonb_set(pg_temp.valid_desktop_snapshot_v3(), '{tasks,0,linkedDocumentIds,0}', to_jsonb(E'\n'::text))) $$,
  '22023',
  'desktop snapshot validation failed',
  'V3 rejects a newline-only relation identifier'
);

select throws_ok(
  $$ select public.validate_desktop_snapshot_v3(3::smallint, jsonb_set(pg_temp.valid_desktop_snapshot_v3(), '{knowledgeFolders,0,path,0}', to_jsonb(E'\r\t'::text))) $$,
  '22023',
  'desktop snapshot validation failed',
  'V3 rejects a whitespace-only folder path segment'
);

select * from finish();
rollback;
