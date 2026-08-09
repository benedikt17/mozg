begin;

select no_plan();

select has_column('public', 'canvases', 'project_id', 'Canvases persist Project scope');
select has_column('public', 'canvas_groups', 'project_id', 'Canvas groups persist Project scope');
select col_not_null('public', 'canvases', 'project_id', 'Canvas Project is required');
select col_not_null('public', 'canvas_groups', 'project_id', 'Canvas group Project is required');
select has_function(
  'public',
  'create_canvas_for_project',
  array['uuid', 'text', 'text', 'uuid'],
  'project-scoped Canvas creator exists'
);
select has_function(
  'public',
  'create_canvas_group_for_project',
  array['uuid', 'text', 'text', 'uuid'],
  'project-scoped Canvas group creator exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_canvas_for_project(uuid,text,text,uuid)',
    'EXECUTE'
  ),
  'authenticated may execute project-scoped Canvas creation'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_canvas_group_for_project(uuid,text,text,uuid)',
    'EXECUTE'
  ),
  'authenticated may execute project-scoped Canvas group creation'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'canvases_group_workspace_project_fkey'
      and conrelid = 'public.canvases'::regclass
  ),
  'Canvas-to-group relation includes Project scope'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'canvas_groups_parent_workspace_project_fkey'
      and conrelid = 'public.canvas_groups'::regclass
  ),
  'nested Canvas groups include Project scope'
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
  '15000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'canvas-project-owner@example.test',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

insert into public.workspaces (id, name)
values ('25000000-0000-0000-0000-000000000001', 'Canvas Project Scope');

insert into public.workspace_members (workspace_id, user_id, role)
values (
  '25000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-000000000001',
  'owner'
);

insert into public.workspace_snapshots (
  workspace_id,
  schema_version,
  snapshot,
  revision
)
values (
  '25000000-0000-0000-0000-000000000001',
  3,
  '{
    "schemaVersion":3,
    "projects":[
      {"id":"project-a","name":"A","shortName":"A","description":""},
      {"id":"project-b","name":"B","shortName":"B","description":""}
    ],
    "overviewDirections":[],
    "taskGroups":[],
    "taskLists":[],
    "tasks":[],
    "knowledgeFolders":[],
    "documents":[]
  }'::jsonb,
  1
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '15000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$ select * from public.create_canvas_group_for_project(
    '25000000-0000-0000-0000-000000000001'::uuid,
    'project-a',
    'A group',
    null
  ) $$,
  'owner creates a group inside Project A'
);

select lives_ok(
  $$ select * from public.create_canvas_for_project(
    '25000000-0000-0000-0000-000000000001'::uuid,
    'project-a',
    'A Canvas',
    null
  ) $$,
  'owner creates a Canvas inside Project A'
);

select lives_ok(
  $$ select * from public.create_canvas_for_project(
    '25000000-0000-0000-0000-000000000001'::uuid,
    'project-b',
    'B Canvas',
    null
  ) $$,
  'owner creates a Canvas inside Project B'
);

select is(
  (
    select count(*)::bigint
    from public.canvases
    where workspace_id = '25000000-0000-0000-0000-000000000001'::uuid
      and project_id = 'project-a'
      and deleted_at is null
  ),
  1::bigint,
  'Project A has exactly its own Canvas'
);
select is(
  (
    select count(*)::bigint
    from public.canvases
    where workspace_id = '25000000-0000-0000-0000-000000000001'::uuid
      and project_id = 'project-b'
      and deleted_at is null
  ),
  1::bigint,
  'Project B has exactly its own Canvas'
);

select throws_ok(
  $$ select * from public.create_canvas_for_project(
    '25000000-0000-0000-0000-000000000001'::uuid,
    'missing-project',
    'Invalid',
    null
  ) $$,
  '22023',
  'Canvas project is unavailable',
  'Canvas creation rejects a Project absent from the Desktop Snapshot'
);

select throws_ok(
  $$ select * from public.create_canvas_for_project(
    '25000000-0000-0000-0000-000000000001'::uuid,
    'project-b',
    'Cross project group',
    (
      select id
      from public.canvas_groups
      where workspace_id = '25000000-0000-0000-0000-000000000001'::uuid
        and project_id = 'project-a'
        and title = 'A group'
    )
  ) $$,
  '22023',
  'Canvas group is unavailable',
  'Project B cannot create a Canvas inside a Project A group'
);

select throws_ok(
  $$ update public.canvases
     set project_id = 'project-b'
     where workspace_id = '25000000-0000-0000-0000-000000000001'::uuid
       and project_id = 'project-a'
       and title = 'A Canvas' $$,
  '22023',
  'Canvas project is immutable',
  'authenticated clients cannot reassign Canvas ownership across Projects'
);

reset role;

select * from finish();
rollback;
