begin;

select no_plan();

create function public.test_valid_desktop_snapshot_v1()
returns jsonb
language sql
immutable
as $$
  select '{"schemaVersion":1,"projects":[{"id":"project-1","name":"","shortName":"","description":""}],"overviewDirections":[],"taskGroups":[],"taskLists":[],"tasks":[],"knowledgeFolders":[],"documents":[]}'::jsonb
$$;

create function public.test_valid_desktop_snapshot_v1_with_deleted_at()
returns jsonb
language sql
immutable
as $$
  select jsonb_set(
    public.test_valid_desktop_snapshot_v1(),
    '{documents}',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'document-deleted-1',
        'projectId', 'project-1',
        'folder', '',
        'folderPath', jsonb_build_array(),
        'title', 'Deleted article',
        'excerpt', 'A deleted Knowledge article',
        'content', jsonb_build_array('# Deleted article', '', 'Preserved Markdown'),
        'linkedTaskIds', jsonb_build_array(),
        'backlinks', jsonb_build_array(),
        'deletedAt', '2026-08-06T07:20:31.123Z'
      )
    )
  )
$$;

create function public.test_valid_desktop_snapshot_v1_with_multiple_deleted_at()
returns jsonb
language sql
immutable
as $$
  select jsonb_set(
    public.test_valid_desktop_snapshot_v1(),
    '{documents}',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'document-deleted-1',
        'projectId', 'project-1',
        'folder', '',
        'folderPath', jsonb_build_array(),
        'title', 'Deleted article one',
        'excerpt', '',
        'content', jsonb_build_array('# Deleted article one'),
        'linkedTaskIds', jsonb_build_array(),
        'backlinks', jsonb_build_array(),
        'deletedAt', '2026-08-06T07:20:31.123Z'
      ),
      jsonb_build_object(
        'id', 'document-deleted-2',
        'projectId', 'project-1',
        'folder', '',
        'folderPath', jsonb_build_array(),
        'title', 'Deleted article two',
        'excerpt', '',
        'content', jsonb_build_array('# Deleted article two'),
        'linkedTaskIds', jsonb_build_array(),
        'backlinks', jsonb_build_array(),
        'deletedAt', '2026-08-06T07:20:31Z'
      )
    )
  )
$$;

create function public.test_valid_desktop_snapshot_v1_with_restored_document()
returns jsonb
language sql
immutable
as $$
  select jsonb_set(
    public.test_valid_desktop_snapshot_v1(),
    '{documents}',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'document-restored-1',
        'projectId', 'project-1',
        'folder', '',
        'folderPath', jsonb_build_array(),
        'title', 'Restored article',
        'excerpt', '',
        'content', jsonb_build_array('# Restored article'),
        'linkedTaskIds', jsonb_build_array(),
        'backlinks', jsonb_build_array()
      )
    )
  )
$$;

create function public.test_reject_desktop_snapshot_v1(target jsonb, version smallint default 1)
returns void
language plpgsql
as $$
begin
  perform * from public.save_workspace_snapshot(
    '22000000-0000-0000-0000-000000000001'::uuid,
    2::bigint,
    version,
    target
  );
  raise exception 'expected desktop snapshot validation failure';
exception when sqlstate '22023' then
  null;
end;
$$;

create function public.test_valid_desktop_snapshot_v2()
returns jsonb
language sql
immutable
as $$
  select '{"schemaVersion":2,"projects":[{"id":"project-1","name":"","shortName":"","description":""}],"overviewDirections":[{"id":"direction-1","projectId":"project-1","title":"","order":0}],"taskGroups":[{"id":"group-1","projectId":"project-1","title":"","order":0,"kind":"system"}],"taskLists":[{"id":"list-1","projectId":"project-1","groupId":"group-1","title":"","order":0,"kind":"system","overviewDirectionId":"direction-1"}],"tasks":[{"id":"task-1","projectId":"project-1","title":"","overviewDirectionId":"direction-1","overviewOrder":0,"taskListOrder":0,"listId":"list-1","showOnOverview":false,"completedAt":null,"signal":"none","starred":false,"myDay":false,"links":[],"linkedDocumentIds":[],"subtasks":[{"id":"subtask-1","title":"Duplicate titles are valid","done":false,"detailsMarkdown":"- First point\\n\\n[Reference](https://example.test/details)"}]}],"knowledgeFolders":[],"documents":[]}'::jsonb
$$;

create function public.test_valid_user_list_desktop_snapshot_v2()
returns jsonb
language sql
immutable
as $$
  select '{"schemaVersion":2,"projects":[{"id":"project-1","name":"","shortName":"","description":""}],"overviewDirections":[{"id":"direction-1","projectId":"project-1","title":"","order":0}],"taskGroups":[{"id":"user-group-1","projectId":"project-1","title":"","order":0,"kind":"user"}],"taskLists":[{"id":"user-list-1","projectId":"project-1","groupId":"user-group-1","title":"","order":0,"kind":"user"}],"tasks":[{"id":"user-task-1","projectId":"project-1","title":"","overviewDirectionId":"","overviewOrder":0,"taskListOrder":0,"listId":"user-list-1","showOnOverview":false,"completedAt":null,"signal":"none","starred":false,"myDay":false,"links":[],"linkedDocumentIds":[],"subtasks":[]}],"knowledgeFolders":[],"documents":[]}'::jsonb
$$;

create function public.test_valid_desktop_snapshot_v3()
returns jsonb
language sql
immutable
as $$
  select '{"schemaVersion":3,"projects":[{"id":"project-1","name":"","shortName":"","description":""}],"overviewDirections":[{"id":"direction-1","projectId":"project-1","title":"","order":0}],"taskGroups":[{"id":"group-1","projectId":"project-1","title":"","order":0,"kind":"system"}],"taskLists":[{"id":"list-1","projectId":"project-1","groupId":"group-1","title":"","order":0,"kind":"system","overviewDirectionId":"direction-1"}],"tasks":[{"id":"task-1","projectId":"project-1","title":"","overviewDirectionId":"direction-1","overviewOrder":0,"taskListOrder":0,"listId":"list-1","showOnOverview":false,"completedAt":null,"signal":"none","starred":false,"myDay":false,"links":[],"linkedDocumentIds":["document-1"],"subtasks":[{"id":"subtask-1","title":"Duplicate titles are valid","done":false,"detailsMarkdown":"- First point\\n\\n[Reference](https://example.test/details)"}]}],"knowledgeFolders":[],"documents":[{"id":"document-1","projectId":"project-1","folder":"","folderPath":[],"isKeyDocument":false,"title":"","excerpt":"","content":[],"backlinks":[]}]}'::jsonb
$$;

create function public.test_reject_desktop_snapshot_v2(target jsonb, version smallint default 2)
returns void
language plpgsql
as $$
begin
  perform * from public.save_workspace_snapshot(
    '22000000-0000-0000-0000-000000000001'::uuid,
    2::bigint,
    version,
    target
  );
  raise exception 'expected desktop snapshot validation failure';
exception when sqlstate '22023' then
  null;
end;
$$;

create function public.test_reject_desktop_snapshot_v3(target jsonb, version smallint default 3)
returns void
language plpgsql
as $$
begin
  perform * from public.save_workspace_snapshot(
    '22000000-0000-0000-0000-000000000001'::uuid,
    4::bigint,
    version,
    target
  );
  raise exception 'expected desktop snapshot validation failure';
exception when sqlstate '22023' then
  null;
end;
$$;

select has_table('public', 'workspace_snapshots', 'workspace_snapshots table exists');
select has_function(
  'public',
  'save_workspace_snapshot',
  array['uuid', 'bigint', 'smallint', 'jsonb'],
  'CAS snapshot function exists'
);
select has_function(
  'public',
  'initialize_workspace_snapshot',
  array['uuid', 'smallint', 'jsonb'],
  'owner-only snapshot initializer exists'
);
select has_function(
  'public',
  'validate_desktop_snapshot_v3',
  array['smallint', 'jsonb'],
  'desktop snapshot v3 validator exists'
);
select ok(
  pg_get_functiondef('public.validate_desktop_snapshot_v3(smallint,jsonb)'::regprocedure) not ilike '%validate_desktop_snapshot_v1%'
    and pg_get_functiondef('public.validate_desktop_snapshot_v3(smallint,jsonb)'::regprocedure) not ilike '%validate_desktop_snapshot_v2%',
  'desktop snapshot v3 validator is isolated from historical validators'
);
select has_trigger(
  'public',
  'workspace_snapshots',
  'workspace_snapshots_guard_workspace_id',
  'snapshot workspace_id guard exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.workspace_snapshots'::regclass),
  true,
  'workspace_snapshots has RLS enabled'
);
select is(
  has_table_privilege('anon', 'public.workspace_snapshots', 'SELECT'),
  true,
  'anonymous SELECT is available for RLS filtering only'
);
select is(
  has_table_privilege('authenticated', 'public.workspace_snapshots', 'DELETE'),
  false,
  'authenticated clients cannot delete snapshots directly'
);
select is(
  has_table_privilege('authenticated', 'public.workspace_snapshots', 'UPDATE'),
  false,
  'authenticated clients cannot bypass CAS with direct updates'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.save_workspace_snapshot(uuid,bigint,smallint,jsonb)'::regprocedure),
  true,
  'CAS function is SECURITY DEFINER with explicit membership authorization'
);
select ok(
  (select array_to_string(proconfig, ',') = 'search_path=pg_catalog, public'
   from pg_proc where oid = 'public.save_workspace_snapshot(uuid,bigint,smallint,jsonb)'::regprocedure),
  'CAS function has an explicit safe search_path'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.initialize_workspace_snapshot(uuid,smallint,jsonb)'::regprocedure),
  true,
  'snapshot initializer is SECURITY DEFINER with explicit membership authorization'
);
select ok(
  (select array_to_string(proconfig, ',') = 'search_path=pg_catalog, public'
   from pg_proc where oid = 'public.initialize_workspace_snapshot(uuid,smallint,jsonb)'::regprocedure),
  'snapshot initializer has an explicit safe search_path'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('12000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'snapshot-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('12000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'snapshot-editor@example.test', '', now(), '{}', '{}', now(), now()),
  ('12000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'snapshot-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('12000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'snapshot-outsider@example.test', '', now(), '{}', '{}', now(), now());

delete from public.workspaces;

insert into public.workspaces (id, name)
values
  ('22000000-0000-0000-0000-000000000001', 'Snapshot workspace'),
  ('22000000-0000-0000-0000-000000000002', 'Disposable workspace'),
  ('22000000-0000-0000-0000-000000000003', 'Initializer workspace'),
  ('22000000-0000-0000-0000-000000000004', 'Deleted article workspace'),
  ('22000000-0000-0000-0000-000000000005', 'V3 initializer workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'owner'),
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002', 'editor'),
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000003', 'viewer'),
  ('22000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000001', 'owner'),
  ('22000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000001', 'owner'),
  ('22000000-0000-0000-0000-000000000004', '12000000-0000-0000-0000-000000000001', 'owner'),
  ('22000000-0000-0000-0000-000000000005', '12000000-0000-0000-0000-000000000001', 'owner');

insert into public.workspace_snapshots (workspace_id, snapshot)
values
  ('22000000-0000-0000-0000-000000000001', public.test_valid_desktop_snapshot_v1()),
  ('22000000-0000-0000-0000-000000000002', public.test_valid_desktop_snapshot_v1()),
  ('22000000-0000-0000-0000-000000000004', public.test_valid_desktop_snapshot_v1());

select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, schema_version, snapshot) values ('22000000-0000-0000-0000-000000000001', 0, '{}') $$,
  '23514',
  null,
  'table check rejects non-positive schema version'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, revision, snapshot) values ('22000000-0000-0000-0000-000000000001', 0, '{}') $$,
  '23514',
  null,
  'table check rejects non-positive revision'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000002', '[]') $$,
  '23514',
  null,
  'table check rejects non-object snapshot'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select results_eq(
  $$ select count(*)::bigint from public.workspace_snapshots $$,
  array[0::bigint],
  'anonymous cannot read snapshots'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000001', '{}') $$,
  '42501',
  null,
  'anonymous cannot insert snapshots'
);
select throws_ok(
  $$ select * from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 1::bigint, 1::smallint, '{}'::jsonb) $$,
  '42501',
  null,
  'anonymous cannot execute the CAS function'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000002', public.test_valid_desktop_snapshot_v1()) $$,
  '42501',
  null,
  'owner cannot directly insert a valid snapshot'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000002', '{}') $$,
  '42501',
  null,
  'owner cannot directly insert an invalid v1 snapshot'
);
select lives_ok(
  $$ select public.initialize_workspace_snapshot('22000000-0000-0000-0000-000000000003'::uuid, 2::smallint, public.test_valid_desktop_snapshot_v2()) $$,
  'owner initializes a validated v2 snapshot through the RPC'
);
select is(
  (select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000003'),
  1::bigint,
  'initializer creates revision one'
);
select is(
  (select schema_version from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000003'),
  2::smallint,
  'initializer stores the requested supported schema version'
);
select lives_ok(
  $$ select public.initialize_workspace_snapshot('22000000-0000-0000-0000-000000000003'::uuid, 2::smallint, public.test_valid_desktop_snapshot_v2()) $$,
  'initializer is idempotent when a concurrent snapshot already exists'
);
select is(
  (select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000003'),
  1::bigint,
  'idempotent initializer does not overwrite the existing snapshot'
);
select lives_ok(
  $$ select public.initialize_workspace_snapshot('22000000-0000-0000-0000-000000000005'::uuid, 3::smallint, public.test_valid_desktop_snapshot_v3()) $$,
  'owner initializes a validated v3 snapshot through the RPC'
);
select is(
  (select schema_version from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000005'),
  3::smallint,
  'v3 initializer stores schema version three'
);
select lives_ok(
  $$ select public.initialize_workspace_snapshot('22000000-0000-0000-0000-000000000003'::uuid, 3::smallint, public.test_valid_desktop_snapshot_v3()) $$,
  'initializer does not overwrite an existing v2 snapshot with v3'
);
select is(
  (select schema_version from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000003'),
  2::smallint,
  'existing initializer snapshot remains at its original schema version'
);
select throws_ok(
  $$ select public.initialize_workspace_snapshot('22000000-0000-0000-0000-000000000002'::uuid, 1::smallint, public.test_valid_desktop_snapshot_v1()) $$,
  '22023',
  'desktop snapshot schema version is not supported',
  'initializer preserves the previous unsupported v1 behavior'
);
select is(
  (select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  1::bigint,
  'initial snapshot revision is one'
);
select is(
  (select schema_version from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  1::smallint,
  'initial schema version is one'
);
select ok(
  (select created_at is not null and updated_at is not null
   from public.workspace_snapshots
   where workspace_id = '22000000-0000-0000-0000-000000000001'),
  'snapshot timestamps are populated'
);
select throws_ok(
  $$ update public.workspace_snapshots set workspace_id = '22000000-0000-0000-0000-000000000002' where workspace_id = '22000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'owner cannot bypass CAS to change snapshot workspace_id'
);
select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 1::bigint, 1::smallint, public.test_valid_desktop_snapshot_v1()) $$,
  array['saved:2'::text],
  'owner CAS save succeeds and returns saved revision'
);
select is(
  (select snapshot->'projects'->0->>'id' from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  'project-1'::text,
  'successful CAS save stores the new snapshot'
);

select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000004'::uuid, 1::bigint, 1::smallint, public.test_valid_desktop_snapshot_v1_with_deleted_at()) $$,
  array['saved:2'::text],
  'owner CAS accepts a valid deletedAt Knowledge document'
);
select is(
  (select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000004'),
  2::bigint,
  'deletedAt save increments revision'
);
select is(
  (select snapshot->'documents'->0->>'deletedAt' from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000004'),
  '2026-08-06T07:20:31.123Z'::text,
  'saved snapshot reload preserves the exact deletedAt value'
);
select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000004'::uuid, 2::bigint, 1::smallint, public.test_valid_desktop_snapshot_v1_with_multiple_deleted_at()) $$,
  array['saved:3'::text],
  'multiple deleted Knowledge documents are accepted'
);
select is(
  (select jsonb_array_length(snapshot->'documents') from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000004'),
  2,
  'multiple deleted documents are persisted'
);
select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000004'::uuid, 3::bigint, 1::smallint, public.test_valid_desktop_snapshot_v1_with_restored_document()) $$,
  array['saved:4'::text],
  'restored document without deletedAt remains valid'
);
select ok(
  (select not (snapshot->'documents'->0 ? 'deletedAt') from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000004'),
  'restored document omits deletedAt'
);

select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1_with_deleted_at(), '{documents,0,deletedAt}', 'null'::jsonb)) $$, 'deletedAt null is rejected with 22023');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1_with_deleted_at(), '{documents,0,deletedAt}', '123'::jsonb)) $$, 'deletedAt number is rejected with 22023');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1_with_deleted_at(), '{documents,0,deletedAt}', 'true'::jsonb)) $$, 'deletedAt boolean is rejected with 22023');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1_with_deleted_at(), '{documents,0,deletedAt}', '[]'::jsonb)) $$, 'deletedAt array is rejected with 22023');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1_with_deleted_at(), '{documents,0,deletedAt}', '{}'::jsonb)) $$, 'deletedAt object is rejected with 22023');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1_with_deleted_at(), '{documents,0,deletedAt}', to_jsonb(''::text))) $$, 'empty deletedAt is rejected with 22023');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1_with_deleted_at(), '{documents,0,deletedAt}', '"yesterday"'::jsonb)) $$, 'malformed deletedAt is rejected with 22023');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1_with_deleted_at(), '{documents,0,deletedAt}', '"2026-99-99T07:20:31Z"'::jsonb)) $$, 'invalid deletedAt date is rejected with 22023');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1_with_deleted_at(), '{documents,0,unknownField}', 'true'::jsonb)) $$, 'unknown document field remains rejected');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1_with_deleted_at(), '{projects,0,deletedAt}', '"2026-08-06T07:20:31Z"'::jsonb)) $$, 'deletedAt on an unrelated entity remains rejected');
select is(
  (select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  2::bigint,
  'invalid deletedAt values do not increment revision'
);

select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000003'::uuid, 1::bigint, 2::smallint, public.test_valid_user_list_desktop_snapshot_v2()) $$,
  array['saved:2'::text],
  'owner CAS saves a valid user-list task snapshot'
);
select is(
  (select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000003'),
  2::bigint,
  'user-list snapshot save increments its revision'
);
select is(
  (select snapshot from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000003'),
  public.test_valid_user_list_desktop_snapshot_v2(),
  'user-list task snapshot persists unchanged'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(jsonb_set(public.test_valid_user_list_desktop_snapshot_v2(), '{tasks,0,showOnOverview}', 'true'::jsonb)) $$,
  'user-list task cannot be visible on Overview'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(jsonb_set(public.test_valid_desktop_snapshot_v2(), '{tasks,0,overviewDirectionId}', '""'::jsonb)) $$,
  'system-list task cannot use an empty Overview direction'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(jsonb_set(public.test_valid_desktop_snapshot_v2(), '{tasks,0,overviewDirectionId}', '"missing-direction"'::jsonb)) $$,
  'system-list task cannot reference a dangling Overview direction'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(jsonb_set(public.test_valid_user_list_desktop_snapshot_v2(), '{tasks,0,listId}', '"missing-list"'::jsonb)) $$,
  'user-list task with a missing list is rejected'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(jsonb_set(jsonb_set(public.test_valid_user_list_desktop_snapshot_v2(), '{projects}', public.test_valid_user_list_desktop_snapshot_v2()->'projects' || '[{"id":"project-2","name":"","shortName":"","description":""}]'::jsonb), '{tasks,0,projectId}', '"project-2"'::jsonb)) $$,
  'cross-project task and user-list relation is rejected'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(jsonb_set(public.test_valid_user_list_desktop_snapshot_v2(), '{taskGroups,0,kind}', '"system"'::jsonb)) $$,
  'user-list and task-group kind mismatch is rejected'
);

select lives_ok($$ select public.test_reject_desktop_snapshot_v1('{}'::jsonb) $$, 'empty snapshot is rejected with 22023');
select is((select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), 2::bigint, 'empty snapshot leaves revision unchanged');
select is((select snapshot from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), public.test_valid_desktop_snapshot_v1(), 'empty snapshot leaves winner unchanged');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1('{"projects":[]}'::jsonb) $$, 'missing collections are rejected with 22023');
select is((select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), 2::bigint, 'missing collections leave revision unchanged');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(public.test_valid_desktop_snapshot_v1() - 'tasks') $$, 'missing tasks are rejected with 22023');
select is((select snapshot from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), public.test_valid_desktop_snapshot_v1(), 'missing tasks leave winner unchanged');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1(), '{tasks}', '{}'::jsonb)) $$, 'non-array tasks are rejected with 22023');
select is((select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), 2::bigint, 'non-array tasks leave revision unchanged');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(public.test_valid_desktop_snapshot_v1() || '{"future":true}'::jsonb) $$, 'unknown top-level field is rejected with 22023');
select is((select snapshot from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), public.test_valid_desktop_snapshot_v1(), 'unknown field leaves winner unchanged');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(public.test_valid_desktop_snapshot_v1(), 2::smallint) $$, 'schema version mismatch is rejected with 22023');
select is((select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), 2::bigint, 'schema mismatch leaves revision unchanged');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1(), '{tasks}', '[{}]'::jsonb)) $$, 'malformed task is rejected with 22023');
select is((select snapshot from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), public.test_valid_desktop_snapshot_v1(), 'malformed task leaves winner unchanged');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1(), '{tasks}', '[{"id":"task-1","projectId":"project-1","title":"","overviewDirectionId":"missing","overviewOrder":0,"taskListOrder":0,"listId":"missing","showOnOverview":false,"completedAt":null,"signal":"none","starred":false,"myDay":false,"links":[],"linkedDocumentIds":[],"subtasks":[]}]'::jsonb)) $$, 'task with missing list is rejected with 22023');
select is((select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), 2::bigint, 'missing list leaves revision unchanged');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(jsonb_set(public.test_valid_desktop_snapshot_v1(), '{tasks}', '[{"id":"task-1","projectId":"project-1","title":"","overviewDirectionId":"missing","overviewOrder":0,"taskListOrder":0,"listId":"missing","showOnOverview":false,"completedAt":null,"signal":"none","starred":false,"myDay":false,"links":[],"linkedDocumentIds":["document-1"],"subtasks":[]}]'::jsonb), '{documents}', '[{"id":"document-1","projectId":"project-2","folder":"","title":"","excerpt":"","content":[],"linkedTaskIds":[],"backlinks":[]}]'::jsonb)) $$, 'cross-project task document relation is rejected with 22023');
select is((select snapshot from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), public.test_valid_desktop_snapshot_v1(), 'cross-project relation leaves winner unchanged');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1(), '{tasks}', '[{"id":"task-1","projectId":"project-1","title":"","overviewDirectionId":"missing","overviewOrder":0,"taskListOrder":0,"listId":"missing","showOnOverview":false,"completedAt":null,"signal":"none","starred":false,"myDay":false,"links":[],"linkedDocumentIds":[],"subtasks":[]},{"id":"task-1","projectId":"project-1","title":"","overviewDirectionId":"missing","overviewOrder":0,"taskListOrder":0,"listId":"missing","showOnOverview":false,"completedAt":null,"signal":"none","starred":false,"myDay":false,"links":[],"linkedDocumentIds":[],"subtasks":[]}]'::jsonb)) $$, 'duplicate task ID is rejected with 22023');
select is((select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), 2::bigint, 'duplicate task leaves revision unchanged');
select lives_ok($$ select public.test_reject_desktop_snapshot_v1(jsonb_set(public.test_valid_desktop_snapshot_v1(), '{tasks}', '[{"id":"task-1","projectId":"project-1","title":"","overviewDirectionId":"missing","overviewOrder":0,"taskListOrder":0,"listId":"missing","showOnOverview":false,"completedAt":null,"signal":"none","starred":false,"myDay":false,"links":[{}],"linkedDocumentIds":[],"subtasks":[]}]'::jsonb)) $$, 'malformed nested link is rejected with 22023');
select is((select snapshot from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'), public.test_valid_desktop_snapshot_v1(), 'malformed nested record leaves winner unchanged');
select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 1::bigint, 1::smallint, public.test_valid_desktop_snapshot_v1()) $$,
  array['conflict:2'::text],
  'stale expected revision returns conflict without overwriting'
);
select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 1::bigint, 1::smallint, public.test_valid_desktop_snapshot_v1()) $$,
  array['conflict:2'::text],
  'repeated stale save returns conflict again'
);
select is(
  (select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  2::bigint,
  'conflict leaves server revision unchanged'
);

select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 2::bigint, 2::smallint, public.test_valid_desktop_snapshot_v2()) $$,
  array['saved:3'::text],
  'owner CAS upgrades a v1 snapshot to v2'
);
select is(
  (select schema_version from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  2::smallint,
  'v1 to v2 upgrade stores schema version two'
);
select is(
  (select snapshot->'tasks'->0->'subtasks'->0->>'detailsMarkdown' from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  '- First point\n\n[Reference](https://example.test/details)'::text,
  'v2 upgrade stores structured subtask details'
);
select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 3::bigint, 2::smallint, public.test_valid_desktop_snapshot_v2()) $$,
  array['saved:4'::text],
  'owner CAS saves a v2 snapshot'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(jsonb_set(public.test_valid_desktop_snapshot_v2(), '{tasks,0,subtasks,0}', '{"id":"subtask-1","title":"Missing details","done":false}'::jsonb)) $$,
  'v2 subtask without detailsMarkdown is rejected'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(jsonb_set(public.test_valid_desktop_snapshot_v2(), '{tasks,0,subtasks,0,detailsMarkdown}', 'false'::jsonb)) $$,
  'v2 non-string detailsMarkdown is rejected'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(jsonb_set(public.test_valid_desktop_snapshot_v2(), '{tasks,0,subtasks,0,futureField}', 'true'::jsonb)) $$,
  'v2 unknown subtask fields are rejected'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(public.test_valid_desktop_snapshot_v2(), 3::smallint) $$,
  'future schema versions are rejected'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(public.test_valid_desktop_snapshot_v1(), 2::smallint) $$,
  'target and payload schema mismatch is rejected'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v2(public.test_valid_desktop_snapshot_v1(), 1::smallint) $$,
  'v2 rows reject downgrade saves to v1'
);
select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 3::bigint, 2::smallint, public.test_valid_desktop_snapshot_v2()) $$,
  array['conflict:4'::text],
  'stale v2 CAS save returns a typed conflict'
);
select is(
  (select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  4::bigint,
  'v2 validation and stale save attempts leave revision unchanged'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v3(jsonb_set(public.test_valid_desktop_snapshot_v3(), '{documents,0,linkedTaskIds}', '["task-1"]'::jsonb)) $$,
  'v3 rejects the obsolete reverse document relation field'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v3(jsonb_set(public.test_valid_desktop_snapshot_v3(), '{tasks,0,linkedDocumentIds}', '["missing-document"]'::jsonb)) $$,
  'v3 rejects dangling task-owned document relations'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v3(jsonb_set(jsonb_set(public.test_valid_desktop_snapshot_v3(), '{projects}', '[{"id":"project-1","name":"","shortName":"","description":""},{"id":"project-2","name":"","shortName":"","description":""}]'::jsonb), '{documents,0,projectId}', '"project-2"'::jsonb)) $$,
  'v3 rejects task-owned relations that cross project boundaries'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v3(jsonb_set(public.test_valid_desktop_snapshot_v3(), '{tasks,0,linkedDocumentIds}', '["document-1","document-1"]'::jsonb)) $$,
  'v3 rejects duplicate task-owned document relations'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v3(jsonb_set(public.test_valid_desktop_snapshot_v3(), '{schemaVersion}', '"3"'::jsonb)) $$,
  'v3 rejects string schema version three'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v3(jsonb_set(public.test_valid_desktop_snapshot_v3(), '{schemaVersion}', '4.0'::jsonb)) $$,
  'v3 rejects other numeric schema versions'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v3(jsonb_set(public.test_valid_desktop_snapshot_v3(), '{knowledgeFolders}', '[{"id":"project-2:folder","projectId":"project-1","path":["Folder"]}]'::jsonb)) $$,
  'v3 rejects a knowledge folder with an inconsistent derived project prefix'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v3(jsonb_set(public.test_valid_desktop_snapshot_v3(), '{knowledgeFolders}', '[{"id":"project-1:folder-one","projectId":"project-1","path":["Folder"]},{"id":"project-1:folder-two","projectId":"project-1","path":["Folder"]}]'::jsonb)) $$,
  'v3 rejects duplicate materialized knowledge folder paths'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v3(jsonb_set(public.test_valid_desktop_snapshot_v3(), '{tasks,0,links}', '[{"id":"link-1","title":"","url":""},{"id":"link-1","title":"","url":""}]'::jsonb)) $$,
  'v3 rejects duplicate task link IDs'
);
select lives_ok(
  $$ select public.test_reject_desktop_snapshot_v3(jsonb_set(public.test_valid_desktop_snapshot_v3(), '{tasks,0,subtasks}', '[{"id":"subtask-1","title":"Duplicate titles are valid","done":false,"detailsMarkdown":""},{"id":"subtask-1","title":"Duplicate titles are valid","done":false,"detailsMarkdown":""}]'::jsonb)) $$,
  'v3 rejects duplicate subtask IDs'
);
select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 4::bigint, 3::smallint, jsonb_set(jsonb_set(public.test_valid_desktop_snapshot_v3(), '{schemaVersion}', '3.0'::jsonb), '{documents,0,deletedAt}', '""'::jsonb)) $$,
  array['saved:5'::text],
  'owner CAS accepts numeric schema version three and application-compatible deletedAt'
);
select is(
  (select schema_version from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  3::smallint,
  'v2 to v3 upgrade stores schema version three'
);
select is(
  (select snapshot->'tasks'->0->'linkedDocumentIds' from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  '["document-1"]'::jsonb,
  'v3 upgrade preserves task-owned document relations'
);
select ok(
  not (select snapshot->'documents'->0 ? 'linkedTaskIds' from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  'v3 upgrade does not persist the obsolete reverse relation field'
);
select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 5::bigint, 3::smallint, public.test_valid_desktop_snapshot_v3()) $$,
  array['saved:6'::text],
  'repeated v3 save is accepted after upgrade'
);
select results_eq(
  $$ select status || ':' || revision::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 5::bigint, 3::smallint, public.test_valid_desktop_snapshot_v3()) $$,
  array['conflict:6'::text],
  'stale v3 CAS save returns a typed conflict'
);
select throws_ok(
  $$ select * from public.save_workspace_snapshot('33000000-0000-0000-0000-000000000001'::uuid, 1::bigint, 1::smallint, '{"projects":[]}'::jsonb) $$,
  '42501',
  'workspace access denied',
  'unavailable workspace is not disclosed through CAS'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$ select count(*)::bigint from public.workspace_snapshots $$,
  array[1::bigint],
  'editor can read a member workspace snapshot'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000002', '{}') $$,
  '42501',
  null,
  'editor cannot create an owner-only snapshot'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000002', public.test_valid_desktop_snapshot_v1()) $$,
  '42501',
  null,
  'editor cannot directly insert a valid snapshot'
);
select throws_ok(
  $$ select * from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 2::bigint, 1::smallint, '{"projects":[]}'::jsonb) $$,
  '42501',
  'workspace access denied',
  'editor cannot execute owner-only CAS save'
);
select throws_ok(
  $$ select public.initialize_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 2::smallint, public.test_valid_desktop_snapshot_v2()) $$,
  '42501',
  'workspace access denied',
  'editor cannot execute owner-only snapshot initialization'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$ select count(*)::bigint from public.workspace_snapshots $$,
  array[1::bigint],
  'viewer can read a member workspace snapshot'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000001', public.test_valid_desktop_snapshot_v1()) $$,
  '42501',
  null,
  'viewer cannot directly insert a valid snapshot'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000001', '{}') $$,
  '42501',
  null,
  'viewer cannot directly insert an invalid v1 snapshot'
);
select throws_ok(
  $$ update public.workspace_snapshots set snapshot = '{"projects":[]}' where workspace_id = '22000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'viewer cannot update a snapshot directly'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000004', true);
select results_eq(
  $$ select count(*)::bigint from public.workspace_snapshots $$,
  array[0::bigint],
  'outsider cannot read another workspace snapshot'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000001', public.test_valid_desktop_snapshot_v1()) $$,
  '42501',
  null,
  'outsider cannot directly insert a valid snapshot'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000001', '{}') $$,
  '42501',
  null,
  'outsider cannot create a snapshot in another workspace'
);
select throws_ok(
  $$ select * from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 2::bigint, 1::smallint, '{"projects":[]}'::jsonb) $$,
  '42501',
  'workspace access denied',
  'outsider cannot execute CAS save for another workspace'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ delete from public.workspaces where id = '22000000-0000-0000-0000-000000000002' $$,
  'owner can delete a workspace with snapshot lifecycle cascade'
);
select is(
  (select count(*)::bigint from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000002'),
  0::bigint,
  'workspace deletion cascades its snapshot'
);
reset role;

select * from finish();
rollback;
