begin;

select no_plan();

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
  '76000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'canvas-project-phase2-owner@example.test',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

insert into public.workspaces (id, name)
values ('86000000-0000-0000-0000-000000000002', 'Canvas Project Phase 2');

insert into public.workspace_members (workspace_id, user_id, role)
values (
  '86000000-0000-0000-0000-000000000002',
  '76000000-0000-0000-0000-000000000002',
  'owner'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '76000000-0000-0000-0000-000000000002',
  true
);

select set_config(
  'test.phase2_group_a',
  (
    select id::text
    from public.create_canvas_group_for_project(
      '86000000-0000-0000-0000-000000000002'::uuid,
      'project-a',
      'Project A group',
      null
    )
  ),
  true
);

select set_config(
  'test.phase2_group_b',
  (
    select id::text
    from public.create_canvas_group_for_project(
      '86000000-0000-0000-0000-000000000002'::uuid,
      'project-b',
      'Project B group',
      null
    )
  ),
  true
);

select set_config(
  'test.phase2_canvas_a',
  (
    select id::text
    from public.create_canvas_for_project(
      '86000000-0000-0000-0000-000000000002'::uuid,
      'project-a',
      'Project A Canvas',
      current_setting('test.phase2_group_a')::uuid
    )
  ),
  true
);

select throws_ok(
  $$ select * from public.create_canvas_for_project(
    '86000000-0000-0000-0000-000000000002'::uuid,
    'project-a',
    'Cross-project Canvas',
    current_setting('test.phase2_group_b')::uuid
  ) $$,
  '22023',
  'Canvas group is unavailable in project',
  'Project A cannot create a Canvas inside a Project B group'
);

select throws_ok(
  $$ select * from public.create_canvas_group_for_project(
    '86000000-0000-0000-0000-000000000002'::uuid,
    '',
    'Invalid project group',
    null
  ) $$,
  '22023',
  'invalid Canvas project id',
  'empty Project ids are rejected'
);

reset role;

select is(
  (
    select project_id
    from public.canvas_groups
    where id = current_setting('test.phase2_group_a')::uuid
  ),
  'project-a',
  'Project-aware group creation stores the explicit Project id'
);

select is(
  (
    select project_id
    from public.canvases
    where id = current_setting('test.phase2_canvas_a')::uuid
  ),
  'project-a',
  'Project-aware Canvas creation stores the explicit Project id'
);

select is(
  (
    select group_id::text
    from public.canvases
    where id = current_setting('test.phase2_canvas_a')::uuid
  ),
  current_setting('test.phase2_group_a'),
  'Project-aware Canvas remains attached to a group in the same Project'
);

select * from finish();
rollback;
