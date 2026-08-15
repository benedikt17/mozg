begin;

select no_plan();

select has_table(
  'public',
  'project_file_search_content',
  'Project file content search table exists'
);
select has_function(
  'public',
  'upsert_project_file_search_content',
  array['uuid', 'text', 'uuid', 'text', 'integer'],
  'Project-qualified content-index upsert RPC exists'
);
select has_function(
  'public',
  'list_project_files_needing_search_content',
  array['uuid', 'text', 'integer', 'integer'],
  'Project-qualified backfill RPC exists'
);
select has_function(
  'public',
  'search_project_files',
  array['uuid', 'text', 'text', 'integer'],
  'Project-qualified Files search RPC exists'
);
select is(
  has_table_privilege('authenticated', 'public.project_file_search_content', 'SELECT'),
  true,
  'authenticated clients may read derived search metadata through RLS'
);
select is(
  has_table_privilege('authenticated', 'public.project_file_search_content', 'INSERT'),
  false,
  'authenticated clients cannot bypass the search-index upsert RPC'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.search_project_files(uuid,text,text,integer)',
    'EXECUTE'
  ),
  true,
  'authenticated clients may execute Project-scoped search'
);
select is(
  has_function_privilege(
    'anon',
    'public.search_project_files(uuid,text,text,integer)',
    'EXECUTE'
  ),
  false,
  'anonymous clients cannot execute Files search'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '95000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'search-owner@example.test', '', now(), '{}', '{}', now(), now()
  ),
  (
    '95000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-8000-000000000000',
    'authenticated', 'authenticated', 'search-viewer@example.test', '', now(), '{}', '{}', now(), now()
  ),
  (
    '95000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'search-outsider@example.test', '', now(), '{}', '{}', now(), now()
  );

insert into public.workspaces (id, name)
values ('96000000-0000-4000-8000-000000000001', 'Project Files content search workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('96000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', 'owner'),
  ('96000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000002', 'viewer');

insert into public.workspace_snapshots (workspace_id, schema_version, snapshot)
values (
  '96000000-0000-4000-8000-000000000001',
  3,
  '{"schemaVersion":3,"projects":[{"id":"project-a","name":"A","shortName":"A","description":""},{"id":"project-b","name":"B","shortName":"B","description":""}],"overviewDirections":[{"id":"direction-a","projectId":"project-a","title":"","order":0}],"taskGroups":[{"id":"group-a","projectId":"project-a","title":"","order":0,"kind":"system"}],"taskLists":[{"id":"list-a","projectId":"project-a","groupId":"group-a","title":"","order":0,"kind":"system","overviewDirectionId":"direction-a"}],"tasks":[],"knowledgeFolders":[],"documents":[]}'::jsonb
);

insert into public.project_files (
  id, workspace_id, project_id, folder_id, name, original_name, mime_type,
  byte_size, storage_key, created_by, ready_at
)
values
  (
    '97000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    'project-a', null,
    'architecture-notes.md', 'architecture-notes.md', 'text/markdown',
    120,
    '96000000-0000-4000-8000-000000000001/97000000-0000-4000-8000-000000000001/original',
    '95000000-0000-4000-8000-000000000001', now()
  ),
  (
    '97000000-0000-4000-8000-000000000002',
    '96000000-0000-4000-8000-000000000001',
    'project-b', null,
    'other-project.md', 'other-project.md', 'text/markdown',
    120,
    '96000000-0000-4000-8000-000000000001/97000000-0000-4000-8000-000000000002/original',
    '95000000-0000-4000-8000-000000000001', now()
  ),
  (
    '97000000-0000-4000-8000-000000000003',
    '96000000-0000-4000-8000-000000000001',
    'project-a', null,
    'deleted.md', 'deleted.md', 'text/markdown',
    120,
    '96000000-0000-4000-8000-000000000001/97000000-0000-4000-8000-000000000003/original',
    '95000000-0000-4000-8000-000000000001', now()
  ),
  (
    '97000000-0000-4000-8000-000000000004',
    '96000000-0000-4000-8000-000000000001',
    'project-a', null,
    'pending.md', 'pending.md', 'text/markdown',
    120,
    '96000000-0000-4000-8000-000000000001/97000000-0000-4000-8000-000000000004/original',
    '95000000-0000-4000-8000-000000000001', null
  ),
  (
    '97000000-0000-4000-8000-000000000005',
    '96000000-0000-4000-8000-000000000001',
    'project-a', null,
    'название-про-кощея.md', 'old-name.md', 'text/markdown',
    120,
    '96000000-0000-4000-8000-000000000001/97000000-0000-4000-8000-000000000005/original',
    '95000000-0000-4000-8000-000000000001', now()
  );

update public.project_files
set deleted_at = now()
where id = '97000000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);

select public.upsert_project_file_search_content(
  '96000000-0000-4000-8000-000000000001'::uuid,
  'project-a',
  '97000000-0000-4000-8000-000000000001'::uuid,
  'Здесь описана архитектура приложения и поиск по содержимому файлов.',
  1
);
select public.upsert_project_file_search_content(
  '96000000-0000-4000-8000-000000000001'::uuid,
  'project-b',
  '97000000-0000-4000-8000-000000000002'::uuid,
  'Здесь тоже описана архитектура приложения, но это другой проект.',
  1
);

select results_eq(
  $$ select id::text
     from public.search_project_files(
       '96000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       'архитектура приложения',
       200
     ) $$,
  array['97000000-0000-4000-8000-000000000001'::text],
  'content search returns a matching document from the current Project only'
);

select results_eq(
  $$ select id::text
     from public.search_project_files(
       '96000000-0000-4000-8000-000000000001'::uuid,
       'project-b',
       'архитектура приложения',
       200
     ) $$,
  array['97000000-0000-4000-8000-000000000002'::text],
  'the same query cannot leak a matching document from another Project'
);

select results_eq(
  $$ select id::text
     from public.search_project_files(
       '96000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       'кощея',
       200
     ) $$,
  array['97000000-0000-4000-8000-000000000005'::text],
  'filename search remains available alongside content search'
);

select is(
  (
    select count(*)::integer
    from public.search_project_files(
      '96000000-0000-4000-8000-000000000001'::uuid,
      'project-a',
      'deleted',
      200
    )
  ),
  0,
  'soft-deleted files are excluded from search'
);
select is(
  (
    select count(*)::integer
    from public.search_project_files(
      '96000000-0000-4000-8000-000000000001'::uuid,
      'project-a',
      'pending',
      200
    )
  ),
  0,
  'pending uploads are excluded from search'
);

select results_eq(
  $$ select id::text
     from public.list_project_files_needing_search_content(
       '96000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       1,
       24
     ) $$,
  array['97000000-0000-4000-8000-000000000005'::text],
  'backfill stays in the current Project and returns only ready non-deleted searchable files missing the current index'
);

select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000002', true);
select results_eq(
  $$ select id::text
     from public.search_project_files(
       '96000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       'архитектура',
       200
     ) $$,
  array['97000000-0000-4000-8000-000000000001'::text],
  'viewer can search ready Project files'
);
select throws_ok(
  $$ select public.upsert_project_file_search_content(
       '96000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '97000000-0000-4000-8000-000000000005'::uuid,
       'viewer must not index files',
       1
     ) $$,
  '42501',
  'Project file search content access denied',
  'viewer cannot write derived search content'
);

select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$ select *
     from public.search_project_files(
       '96000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       'архитектура',
       200
     ) $$,
  '42501',
  'Project file search access denied',
  'workspace outsider cannot search Project files'
);

select * from finish();
rollback;
