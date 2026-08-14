begin;

select no_plan();

select has_function(
  'public',
  'reserve_project_file_variant',
  array['uuid', 'text', 'uuid', 'integer', 'bigint', 'integer', 'integer'],
  'Project File variant reserve RPC exists'
);
select has_function(
  'public',
  'finalize_project_file_variant',
  array['uuid', 'text', 'uuid', 'integer'],
  'Project File variant finalize RPC exists'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.reserve_project_file_variant(uuid,text,uuid,integer,bigint,integer,integer)'::regprocedure),
  true,
  'variant reserve is SECURITY DEFINER'
);
select is(
  has_function_privilege('authenticated', 'public.reserve_project_file_variant(uuid,text,uuid,integer,bigint,integer,integer)', 'EXECUTE'),
  true,
  'authenticated clients receive the variant reserve grant'
);
select is(
  has_function_privilege('anon', 'public.reserve_project_file_variant(uuid,text,uuid,integer,bigint,integer,integer)', 'EXECUTE'),
  false,
  'anonymous clients do not receive the variant reserve grant'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('88000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'file-variant-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('88000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'file-variant-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('88000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'file-variant-outsider@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name)
values ('89000000-0000-4000-8000-000000000001', 'Project File variant workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('89000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-000000000001', 'owner'),
  ('89000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-000000000002', 'viewer');

insert into public.workspace_snapshots (workspace_id, schema_version, snapshot)
values (
  '89000000-0000-4000-8000-000000000001',
  3,
  '{"schemaVersion":3,"projects":[{"id":"project-a","name":"A","shortName":"A","description":""},{"id":"project-b","name":"B","shortName":"B","description":""}],"overviewDirections":[{"id":"direction-a","projectId":"project-a","title":"","order":0}],"taskGroups":[{"id":"group-a","projectId":"project-a","title":"","order":0,"kind":"system"}],"taskLists":[{"id":"list-a","projectId":"project-a","groupId":"group-a","title":"","order":0,"kind":"system","overviewDirectionId":"direction-a"}],"tasks":[],"knowledgeFolders":[],"documents":[]}'::jsonb
);

insert into public.project_files (
  id, workspace_id, project_id, folder_id, name, original_name, storage_key,
  mime_type, byte_size, width, height, created_by, ready_at
)
values
  (
    '8a000000-0000-4000-8000-000000000001',
    '89000000-0000-4000-8000-000000000001',
    'project-a', null, 'image.png', 'image.png',
    '89000000-0000-4000-8000-000000000001/8a000000-0000-4000-8000-000000000001/original',
    'image/png', 1024, 1200, 400,
    '88000000-0000-4000-8000-000000000001', now()
  ),
  (
    '8a000000-0000-4000-8000-000000000002',
    '89000000-0000-4000-8000-000000000001',
    'project-a', null, 'brief.pdf', 'brief.pdf',
    '89000000-0000-4000-8000-000000000001/8a000000-0000-4000-8000-000000000002/original',
    'application/pdf', 1024, null, null,
    '88000000-0000-4000-8000-000000000001', now()
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '88000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$ select kind || ':' || target_max_edge::text || ':' || (ready_at is null)::text
     from public.reserve_project_file_variant(
       '89000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '8a000000-0000-4000-8000-000000000001'::uuid,
       512, 128, 512, 171
     ) $$,
  array['edge-512:512:true'::text],
  'owner can reserve a rounded WebP tier for a ready Project image'
);

select is(
  (select count(*)::integer from public.file_variants where file_id = '8a000000-0000-4000-8000-000000000001'::uuid),
  0,
  'pending derivative metadata is not exposed through the normal select policy'
);

select throws_ok(
  $$ insert into public.file_variants (
       workspace_id, project_id, file_id, kind, storage_path, mime_type,
       byte_size, pixel_width, pixel_height, target_max_edge
     ) values (
       '89000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '8a000000-0000-4000-8000-000000000001'::uuid,
       'edge-256',
       '89000000-0000-4000-8000-000000000001/8a000000-0000-4000-8000-000000000001/variants/edge-256.webp',
       'image/webp', 64, 256, 85, 256
     ) $$,
  '42501',
  null,
  'authenticated clients cannot bypass the reserve RPC with a direct table insert'
);

select throws_ok(
  $$ select * from public.reserve_project_file_variant(
       '89000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '8a000000-0000-4000-8000-000000000002'::uuid,
       512, 128, 512, 171
     ) $$,
  '22023',
  'Project file image source is unavailable',
  'variant reserve rejects a non-image Project File'
);

select throws_ok(
  $$ select * from public.reserve_project_file_variant(
       '89000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '8a000000-0000-4000-8000-000000000001'::uuid,
       1200, 128, 1200, 400
     ) $$,
  '22023',
  'Project file variant target edge is invalid',
  'variant reserve never creates a derivative equal to the original max edge'
);

select set_config('request.jwt.claim.sub', '88000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$ select * from public.reserve_project_file_variant(
       '89000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '8a000000-0000-4000-8000-000000000001'::uuid,
       256, 64, 256, 85
     ) $$,
  '42501',
  'Project file variant access denied',
  'viewer cannot reserve Project File derivatives'
);

select set_config('request.jwt.claim.sub', '88000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$ select * from public.reserve_project_file_variant(
       '89000000-0000-4000-8000-000000000001'::uuid,
       'project-b',
       '8a000000-0000-4000-8000-000000000001'::uuid,
       256, 64, 256, 85
     ) $$,
  '22023',
  'Project file image source is unavailable',
  'variant reserve cannot cross the Product Project boundary'
);

reset role;
insert into storage.objects (
  id, bucket_id, name, owner, metadata, version, owner_id, user_metadata
)
values (
  gen_random_uuid(),
  'project-files',
  '89000000-0000-4000-8000-000000000001/8a000000-0000-4000-8000-000000000001/variants/edge-512.webp',
  '88000000-0000-4000-8000-000000000001',
  '{"mimetype":"image/webp","size":128}',
  'project-file-variant-version',
  '88000000-0000-4000-8000-000000000001',
  '{}'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '88000000-0000-4000-8000-000000000001', true);
select results_eq(
  $$ select kind || ':' || (ready_at is not null)::text
     from public.finalize_project_file_variant(
       '89000000-0000-4000-8000-000000000001'::uuid,
       'project-a',
       '8a000000-0000-4000-8000-000000000001'::uuid,
       512
     ) $$,
  array['edge-512:true'::text],
  'owner can finalize the exact reserved derivative after Storage metadata matches'
);

select set_config('request.jwt.claim.sub', '88000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.file_variants where file_id = '8a000000-0000-4000-8000-000000000001'::uuid),
  1,
  'workspace viewer can read ready derivative metadata'
);
select is(
  (select count(*)::integer from storage.objects
    where bucket_id = 'project-files'
      and name like '%/variants/edge-512.webp'),
  1,
  'workspace viewer can read the ready derivative object through Storage RLS'
);

select set_config('request.jwt.claim.sub', '88000000-0000-4000-8000-000000000003', true);
select is(
  (select count(*)::integer from public.file_variants),
  0,
  'workspace outsider cannot read derivative metadata'
);
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'project-files'),
  0,
  'workspace outsider cannot read Project File Storage objects'
);

select * from finish();
rollback;
