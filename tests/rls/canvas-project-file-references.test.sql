begin;

select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '13000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'canvas-files-owner@example.test', '',
  now(), '{}', '{}', now(), now()
);

insert into public.workspaces (id, name)
values ('23000000-0000-0000-0000-000000000001', 'Canvas Files workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values (
  '23000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  'owner'
);

insert into public.project_files (
  id, workspace_id, project_id, name, original_name, storage_key,
  mime_type, byte_size, width, height, created_by, ready_at, deleted_at
)
values
(
  '63000000-0000-0000-0000-000000000001',
  '23000000-0000-0000-0000-000000000001', 'project-a',
  'same-project.png', 'same-project.png',
  '23000000-0000-0000-0000-000000000001/63000000-0000-0000-0000-000000000001/original',
  'image/png', 1024, 400, 300,
  '13000000-0000-0000-0000-000000000001', now(), null
),
(
  '63000000-0000-0000-0000-000000000002',
  '23000000-0000-0000-0000-000000000001', 'project-b',
  'other-project.png', 'other-project.png',
  '23000000-0000-0000-0000-000000000001/63000000-0000-0000-0000-000000000002/original',
  'image/png', 1024, 400, 300,
  '13000000-0000-0000-0000-000000000001', now(), null
),
(
  '63000000-0000-0000-0000-000000000003',
  '23000000-0000-0000-0000-000000000001', 'project-a',
  'pending.png', 'pending.png',
  '23000000-0000-0000-0000-000000000001/63000000-0000-0000-0000-000000000003/original',
  'image/png', 1024, 400, 300,
  '13000000-0000-0000-0000-000000000001', null, null
),
(
  '63000000-0000-0000-0000-000000000004',
  '23000000-0000-0000-0000-000000000001', 'project-a',
  'deleted.png', 'deleted.png',
  '23000000-0000-0000-0000-000000000001/63000000-0000-0000-0000-000000000004/original',
  'image/png', 1024, 400, 300,
  '13000000-0000-0000-0000-000000000001', now(), now()
),
(
  '63000000-0000-0000-0000-000000000005',
  '23000000-0000-0000-0000-000000000001', 'project-a',
  'ready.pdf', 'ready.pdf',
  '23000000-0000-0000-0000-000000000001/63000000-0000-0000-0000-000000000005/original',
  'application/pdf', 1228800, null, null,
  '13000000-0000-0000-0000-000000000001', now(), null
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);

select set_config(
  'test.b3_canvas_id',
  (select id::text from public.create_canvas_for_project(
    '23000000-0000-0000-0000-000000000001'::uuid,
    'project-a', 'B3 Canvas', null
  )),
  true
);

select lives_ok(
  $$
  select * from public.save_canvas_document(
    current_setting('test.b3_canvas_id')::uuid, 1, 'B3 Canvas',
    '{"schemaVersion":2,"nodes":[{"id":"file-node-1","kind":"image","fileId":"63000000-0000-0000-0000-000000000001","position":{"x":0,"y":0},"size":{"width":400,"height":300},"zIndex":1,"aspectRatioLocked":true}],"edges":[]}'::jsonb
  )
  $$,
  'Canvas can save a ready image Project File from the same Project'
);

select is(
  (select document #>> '{nodes,0,fileId}' from public.canvases
   where id = current_setting('test.b3_canvas_id')::uuid),
  '63000000-0000-0000-0000-000000000001',
  'Canvas persists durable fileId'
);

select throws_ok(
  $$
  select * from public.save_canvas_document(
    current_setting('test.b3_canvas_id')::uuid, 2, 'B3 Canvas',
    '{"schemaVersion":2,"nodes":[{"id":"file-node-2","kind":"image","fileId":"63000000-0000-0000-0000-000000000002","position":{"x":0,"y":0},"size":{"width":400,"height":300},"zIndex":1,"aspectRatioLocked":true}],"edges":[]}'::jsonb
  )
  $$,
  '22023',
  'Canvas Project File reference is unavailable',
  'Canvas rejects a Project File from another Project'
);

select throws_ok(
  $$
  select * from public.save_canvas_document(
    current_setting('test.b3_canvas_id')::uuid, 2, 'B3 Canvas',
    '{"schemaVersion":2,"nodes":[{"id":"file-node-3","kind":"image","fileId":"63000000-0000-0000-0000-000000000003","position":{"x":0,"y":0},"size":{"width":400,"height":300},"zIndex":1,"aspectRatioLocked":true}],"edges":[]}'::jsonb
  )
  $$,
  '22023',
  'Canvas Project File reference is unavailable',
  'Canvas rejects an unfinished Project File'
);

select throws_ok(
  $$
  select * from public.save_canvas_document(
    current_setting('test.b3_canvas_id')::uuid, 2, 'B3 Canvas',
    '{"schemaVersion":2,"nodes":[{"id":"file-node-4","kind":"image","fileId":"63000000-0000-0000-0000-000000000004","position":{"x":0,"y":0},"size":{"width":400,"height":300},"zIndex":1,"aspectRatioLocked":true}],"edges":[]}'::jsonb
  )
  $$,
  '22023',
  'Canvas Project File reference is unavailable',
  'Canvas rejects a deleted Project File'
);

select lives_ok(
  $$
  select * from public.save_canvas_document(
    current_setting('test.b3_canvas_id')::uuid, 2, 'B3 Canvas',
    '{"schemaVersion":2,"nodes":[{"id":"pdf-node-1","kind":"pdf","fileId":"63000000-0000-0000-0000-000000000005","lastKnownName":"ready.pdf","position":{"x":0,"y":0},"size":{"width":300,"height":180},"zIndex":1}],"edges":[]}'::jsonb
  )
  $$,
  'Canvas can save a ready PDF Project File from the same Project'
);

select throws_ok(
  $$
  select * from public.save_canvas_document(
    current_setting('test.b3_canvas_id')::uuid, 2, 'B3 Canvas',
    '{"schemaVersion":2,"nodes":[{"id":"invalid-source","kind":"image","assetId":"legacy","fileId":"63000000-0000-0000-0000-000000000001","position":{"x":0,"y":0},"size":{"width":400,"height":300},"zIndex":1,"aspectRatioLocked":true}],"edges":[]}'::jsonb
  )
  $$,
  '22023',
  'Canvas image must reference exactly one assetId or fileId',
  'Canvas rejects image nodes with two source identities'
);

select * from finish();
rollback;
