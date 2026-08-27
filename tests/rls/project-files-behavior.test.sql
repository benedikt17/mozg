begin;

select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '85000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'files-owner@example.test', '', now(), '{}', '{}', now(), now()
  ),
  (
    '85000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'files-viewer@example.test', '', now(), '{}', '{}', now(), now()
  ),
  (
    '85000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'files-outsider@example.test', '', now(), '{}', '{}', now(), now()
  );

insert into public.workspaces (id, name)
values ('86000000-0000-4000-8000-000000000001', 'Project Files behavior workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('86000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000001', 'owner'),
  ('86000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000002', 'viewer');

insert into public.workspace_snapshots (workspace_id, schema_version, snapshot)
values (
  '86000000-0000-4000-8000-000000000001',
  3,
  '{"schemaVersion":3,"projects":[{"id":"project-a","name":"A","shortName":"A","description":""},{"id":"project-b","name":"B","shortName":"B","description":""}],"overviewDirections":[{"id":"direction-a","projectId":"project-a","title":"","order":0}],"taskGroups":[{"id":"group-a","projectId":"project-a","title":"","order":0,"kind":"system"}],"taskLists":[{"id":"list-a","projectId":"project-a","groupId":"group-a","title":"","order":0,"kind":"system","overviewDirectionId":"direction-a"}],"tasks":[],"knowledgeFolders":[],"documents":[]}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '85000000-0000-4000-8000-000000000001', true);

select set_config(
  'test.files_folder_a',
  (select id::text from public.create_project_folder(
    '86000000-0000-4000-8000-000000000001'::uuid,
    'project-a',
    'Folder A'
  )),
  true
);
select set_config(
  'test.files_folder_b',
  (select id::text from public.create_project_folder(
    '86000000-0000-4000-8000-000000000001'::uuid,
    'project-b',
    'Folder B'
  )),
  true
);

select results_eq(
  $$ select project_id || ':' || name || ':' || (ready_at is null)::text
     from public.reserve_project_file(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '87000000-0000-4000-8000-000000000001'::uuid,
       'brief.pdf',
       'brief-original.pdf',
       'application/pdf',
       3,
       current_setting('test.files_folder_a')::uuid,
       null,
       null,
       'sha256:deduplicated-pdf-content'
     ) $$,
  array['project-a:brief.pdf:true'::text],
  'owner can reserve a pending file in an existing Snapshot Project'
);

select is(
  (select count(*)::integer from public.project_files where id = '87000000-0000-4000-8000-000000000001'::uuid),
  1,
  'owner/editor read path can inspect pending metadata'
);

select throws_ok(
  $$ select * from public.reserve_project_file(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-missing',
       '87000000-0000-4000-8000-000000000002'::uuid,
       'missing.pdf',
       'missing.pdf',
       'application/pdf',
       3
     ) $$,
  '42501',
  'Project file access denied',
  'reserve rejects a Project id absent from the current Snapshot V3'
);

select throws_ok(
  $$ select * from public.move_project_file(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '87000000-0000-4000-8000-000000000001'::uuid,
       current_setting('test.files_folder_b')::uuid
     ) $$,
  '22023',
  'Project folder target is unavailable',
  'file cannot move into a folder from another Project'
);

select throws_ok(
  $$ select * from public.rename_project_file(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-b',
       '87000000-0000-4000-8000-000000000001'::uuid,
       'wrong-project.pdf'
     ) $$,
  '42501',
  'Project file access denied',
  'qualified mutation cannot act on a file through the wrong Project scope'
);

select throws_ok(
  $$ select * from public.move_project_folder(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       current_setting('test.files_folder_a')::uuid,
       current_setting('test.files_folder_b')::uuid
     ) $$,
  '22023',
  'Project folder target is unavailable',
  'folder cannot move under a folder from another Project'
);

reset role;
insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
values (
  gen_random_uuid(),
  'project-files',
  '86000000-0000-4000-8000-000000000001/87000000-0000-4000-8000-000000000001/original',
  '85000000-0000-4000-8000-000000000001',
  '{"mimetype":"application/pdf","size":3}',
  'files-behavior-version',
  '85000000-0000-4000-8000-000000000001',
  '{}'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '85000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$ select name || ':' || original_name || ':' || (ready_at is not null)::text
     from public.finalize_project_file(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '87000000-0000-4000-8000-000000000001'::uuid
     ) $$,
  array['brief.pdf:brief-original.pdf:true'::text],
  'finalize marks the exact reserved original ready after Storage metadata matches'
);

select results_eq(
  $$ select id::text || ':' || name || ':' || (ready_at is not null)::text
     from public.reserve_project_file(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '87000000-0000-4000-8000-000000000099'::uuid,
       'same-binary-retry.pdf',
       'same-binary-retry.pdf',
       'application/pdf',
       3,
       current_setting('test.files_folder_a')::uuid,
       null,
       null,
       'sha256:deduplicated-pdf-content'
     ) $$,
  array['87000000-0000-4000-8000-000000000001:brief.pdf:true'::text],
  'repeated content reservation returns the ready original instead of a duplicate'
);

select results_eq(
  $$ select name || ':' || original_name || ':' || storage_key
     from public.rename_project_file(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '87000000-0000-4000-8000-000000000001'::uuid,
       'renamed.pdf'
     ) $$,
  array['renamed.pdf:brief-original.pdf:86000000-0000-4000-8000-000000000001/87000000-0000-4000-8000-000000000001/original'::text],
  'rename changes display metadata without changing original_name or Storage key'
);

select results_eq(
  $$ select (deleted_at is not null)::text from public.delete_project_file(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '87000000-0000-4000-8000-000000000001'::uuid
     ) $$,
  array['true'::text],
  'delete is soft'
);

select set_config('request.jwt.claim.sub', '85000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.project_files where id = '87000000-0000-4000-8000-000000000001'::uuid),
  0,
  'viewer cannot read a deleted file'
);
select throws_ok(
  $$ select * from public.restore_project_file(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '87000000-0000-4000-8000-000000000001'::uuid
     ) $$,
  '42501',
  'Project file access denied',
  'viewer cannot restore Project files'
);

select set_config('request.jwt.claim.sub', '85000000-0000-4000-8000-000000000001', true);
select results_eq(
  $$ select (deleted_at is null)::text from public.restore_project_file(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '87000000-0000-4000-8000-000000000001'::uuid
     ) $$,
  array['true'::text],
  'owner can restore a soft-deleted file'
);

select set_config('request.jwt.claim.sub', '85000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.project_files where id = '87000000-0000-4000-8000-000000000001'::uuid),
  1,
  'viewer can read a ready restored file'
);
select throws_ok(
  $$ select * from public.rename_project_file(
       '86000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '87000000-0000-4000-8000-000000000001'::uuid,
       'viewer-rename.pdf'
     ) $$,
  '42501',
  'Project file access denied',
  'viewer cannot mutate Project files'
);

select set_config('request.jwt.claim.sub', '85000000-0000-4000-8000-000000000003', true);
select is(
  (select count(*)::integer from public.project_files),
  0,
  'workspace outsider cannot read Project file metadata'
);
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'project-files'),
  0,
  'workspace outsider cannot read private Project file objects'
);

select * from finish();
rollback;
