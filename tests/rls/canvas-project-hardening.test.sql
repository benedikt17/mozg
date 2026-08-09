begin;

select no_plan();

select is(
  (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'canvases' and column_name = 'project_id'),
  'NO'::text,
  'canvases.project_id is required'
);
select is(
  (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'canvas_groups' and column_name = 'project_id'),
  'NO'::text,
  'canvas_groups.project_id is required'
);

select is(
  has_function_privilege('authenticated', 'public.create_canvas(uuid,text)', 'EXECUTE'),
  false,
  'legacy two-argument Canvas create is retired for authenticated clients'
);
select is(
  has_function_privilege('authenticated', 'public.create_canvas(uuid,text,uuid)', 'EXECUTE'),
  false,
  'legacy grouped Canvas create is retired for authenticated clients'
);
select is(
  has_function_privilege('authenticated', 'public.create_canvas_group(uuid,text,uuid)', 'EXECUTE'),
  false,
  'legacy workspace-only Canvas group create is retired for authenticated clients'
);
select is(
  has_function_privilege('authenticated', 'public.create_canvas_for_project(uuid,text,text,uuid)', 'EXECUTE'),
  true,
  'project-scoped Canvas create remains executable'
);
select is(
  has_function_privilege('authenticated', 'public.create_canvas_group_for_project(uuid,text,text,uuid)', 'EXECUTE'),
  true,
  'project-scoped Canvas group create remains executable'
);

select is(
  (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conname = 'canvases_group_workspace_project_fkey'
  ),
  'FOREIGN KEY (workspace_id, project_id, group_id) REFERENCES canvas_groups(workspace_id, project_id, id) ON DELETE RESTRICT'::text,
  'Canvas to group relation includes Project boundary'
);
select is(
  (
    select pg_get_constraintdef(oid)
      from pg_constraint
     where conname = 'canvas_groups_parent_workspace_project_fkey'
  ),
  'FOREIGN KEY (workspace_id, project_id, parent_group_id) REFERENCES canvas_groups(workspace_id, project_id, id) ON DELETE RESTRICT'::text,
  'Canvas group parent relation includes Project boundary'
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
values (
  '13000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'canvas-project-hardening@example.test',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

insert into public.workspaces (id, name)
values ('23000000-0000-0000-0000-000000000001', 'Canvas project hardening workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values (
  '23000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  'owner'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);

select set_config(
  'test.project_a_group_id',
  (select id::text from public.create_canvas_group_for_project(
    '23000000-0000-0000-0000-000000000001'::uuid,
    'project-a',
    'Project A group',
    null
  )),
  true
);
select set_config(
  'test.project_a_child_group_id',
  (select id::text from public.create_canvas_group_for_project(
    '23000000-0000-0000-0000-000000000001'::uuid,
    'project-a',
    'Project A child',
    null
  )),
  true
);
select set_config(
  'test.project_b_group_id',
  (select id::text from public.create_canvas_group_for_project(
    '23000000-0000-0000-0000-000000000001'::uuid,
    'project-b',
    'Project B group',
    null
  )),
  true
);
select set_config(
  'test.project_a_canvas_id',
  (select id::text from public.create_canvas_for_project(
    '23000000-0000-0000-0000-000000000001'::uuid,
    'project-a',
    'Project A Canvas',
    null
  )),
  true
);

select lives_ok(
  $$ select public.move_canvas_to_group(
    current_setting('test.project_a_canvas_id')::uuid,
    current_setting('test.project_a_group_id')::uuid
  ) $$,
  'same-project Canvas to group move succeeds'
);
select lives_ok(
  $$ select * from public.move_canvas_group(
    current_setting('test.project_a_child_group_id')::uuid,
    current_setting('test.project_a_group_id')::uuid
  ) $$,
  'same-project group parent move succeeds'
);

select throws_ok(
  $$ select public.move_canvas_to_group(
    current_setting('test.project_a_canvas_id')::uuid,
    current_setting('test.project_b_group_id')::uuid
  ) $$,
  '22023',
  'Canvas group is unavailable in project',
  'cross-project Canvas to group move is rejected by RPC'
);
select throws_ok(
  $$ select * from public.move_canvas_group(
    current_setting('test.project_a_child_group_id')::uuid,
    current_setting('test.project_b_group_id')::uuid
  ) $$,
  '22023',
  'Parent Canvas group is unavailable in project',
  'cross-project group parent move is rejected by RPC'
);

select throws_ok(
  $$ select * from public.create_canvas(
    '23000000-0000-0000-0000-000000000001'::uuid,
    'Legacy Canvas'
  ) $$,
  '42501',
  'permission denied for function create_canvas',
  'authenticated clients cannot use retired workspace-only Canvas create'
);

reset role;

select throws_ok(
  $$ update public.canvases
        set group_id = current_setting('test.project_b_group_id')::uuid
      where id = current_setting('test.project_a_canvas_id')::uuid $$,
  '23503',
  null,
  'composite FK rejects a direct cross-project Canvas group link'
);
select throws_ok(
  $$ update public.canvas_groups
        set parent_group_id = current_setting('test.project_b_group_id')::uuid
      where id = current_setting('test.project_a_child_group_id')::uuid $$,
  '23503',
  null,
  'composite FK rejects a direct cross-project group parent link'
);

select throws_ok(
  $$ insert into public.canvases (
       workspace_id, project_id, title, schema_version, document, revision, created_by
     ) values (
       '23000000-0000-0000-0000-000000000001'::uuid,
       null,
       'Missing project',
       2,
       '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb,
       1,
       '13000000-0000-0000-0000-000000000001'::uuid
     ) $$,
  '23502',
  null,
  'direct Canvas insert cannot omit project_id'
);
select throws_ok(
  $$ insert into public.canvas_groups (
       workspace_id, project_id, title, sort_order, created_by
     ) values (
       '23000000-0000-0000-0000-000000000001'::uuid,
       null,
       'Missing project',
       0,
       '13000000-0000-0000-0000-000000000001'::uuid
     ) $$,
  '23502',
  null,
  'direct Canvas group insert cannot omit project_id'
);

select * from finish();
rollback;
