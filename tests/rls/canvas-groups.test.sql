begin;

select no_plan();

select has_table('public', 'canvas_groups', 'canvas_groups table exists');
select has_function(
  'public',
  'create_canvas_group_for_project',
  array['uuid', 'text', 'text', 'uuid'],
  'Project-scoped Canvas group create function exists'
);
select has_function(
  'public',
  'move_canvas_group',
  array['uuid', 'uuid'],
  'Canvas group move function exists'
);
select has_function(
  'public',
  'move_canvas_to_group',
  array['uuid', 'uuid'],
  'Canvas move-to-group function exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.canvas_groups'::regclass),
  true,
  'canvas_groups has RLS enabled'
);
select is(
  has_table_privilege('authenticated', 'public.canvas_groups', 'INSERT'),
  false,
  'authenticated clients cannot insert groups directly'
);
select is(
  has_function_privilege('anon', 'public.create_canvas_group_for_project(uuid,text,text,uuid)', 'EXECUTE'),
  false,
  'anonymous clients cannot create groups'
);
select is(
  has_function_privilege('authenticated', 'public.create_canvas_group_for_project(uuid,text,text,uuid)', 'EXECUTE'),
  true,
  'authenticated clients can create groups through the project-scoped RPC'
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
  ('72000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'canvas-group-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('72000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'canvas-group-editor@example.test', '', now(), '{}', '{}', now(), now()),
  ('72000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'canvas-group-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('72000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'canvas-group-outsider@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name)
values ('82000000-0000-0000-0000-000000000001', 'Canvas groups workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'owner'),
  ('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002', 'editor'),
  ('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000003', 'viewer');

set local role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000001', true);

select set_config(
  'test.canvas_group_root_id',
  (select id::text from public.create_canvas_group_for_project(
    '82000000-0000-0000-0000-000000000001'::uuid,
    'project-a',
    'Root group',
    null
  )),
  true
);
select set_config(
  'test.canvas_group_child_id',
  (select id::text from public.create_canvas_group_for_project(
    '82000000-0000-0000-0000-000000000001'::uuid,
    'project-a',
    'Child group',
    current_setting('test.canvas_group_root_id')::uuid
  )),
  true
);
select set_config(
  'test.canvas_id',
  (select id::text from public.create_canvas_for_project(
    '82000000-0000-0000-0000-000000000001'::uuid,
    'project-a',
    'Grouped canvas',
    current_setting('test.canvas_group_child_id')::uuid
  )),
  true
);

select is(
  (select group_id from public.canvases where id = current_setting('test.canvas_id')::uuid),
  current_setting('test.canvas_group_child_id')::uuid,
  'new Canvas can be created inside a group'
);
select throws_ok(
  $$ select * from public.move_canvas_group(
    current_setting('test.canvas_group_child_id')::uuid,
    current_setting('test.canvas_group_child_id')::uuid
  ) $$,
  '22023',
  'Canvas group cycle is not allowed',
  'group cycle is rejected'
);

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$ select count(*)::bigint from public.canvas_groups $$,
  array[2::bigint],
  'workspace viewer can read active groups'
);
select throws_ok(
  $$ select * from public.rename_canvas_group(
    current_setting('test.canvas_group_child_id')::uuid,
    'Viewer cannot rename'
  ) $$,
  '42501',
  'Canvas group access denied',
  'viewer cannot mutate groups'
);

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000004', true);
select results_eq(
  $$ select count(*)::bigint from public.canvas_groups $$,
  array[0::bigint],
  'workspace outsider cannot read groups'
);

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select * from public.rename_canvas_group(
    current_setting('test.canvas_group_child_id')::uuid,
    'Renamed child'
  ) $$,
  'owner can rename a group'
);
select lives_ok(
  $$ select * from public.delete_canvas_group(
    current_setting('test.canvas_group_root_id')::uuid
  ) $$,
  'owner can archive a group'
);
select is(
  (select parent_group_id from public.canvas_groups where id = current_setting('test.canvas_group_child_id')::uuid),
  null::uuid,
  'archiving a group promotes direct child groups'
);
select is(
  (select group_id from public.canvases where id = current_setting('test.canvas_id')::uuid),
  current_setting('test.canvas_group_child_id')::uuid,
  'archiving a group preserves nested Canvas membership'
);

select * from finish();
rollback;
