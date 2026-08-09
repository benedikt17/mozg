begin;

select no_plan();

select has_column(
  'public',
  'canvases',
  'project_id',
  'Canvases expose the future Desktop Project ownership column'
);
select has_column(
  'public',
  'canvas_groups',
  'project_id',
  'Canvas groups expose the future Desktop Project ownership column'
);
select is(
  (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'canvases'
      and column_name = 'project_id'
  ),
  'YES',
  'Canvas Project ownership remains nullable during compatibility phase'
);
select is(
  (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'canvas_groups'
      and column_name = 'project_id'
  ),
  'YES',
  'Canvas group Project ownership remains nullable during compatibility phase'
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
  '76000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'canvas-project-phase1-owner@example.test',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

insert into public.workspaces (id, name)
values ('86000000-0000-0000-0000-000000000001', 'Canvas Project Phase 1');

insert into public.workspace_members (workspace_id, user_id, role)
values (
  '86000000-0000-0000-0000-000000000001',
  '76000000-0000-0000-0000-000000000001',
  'owner'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '76000000-0000-0000-0000-000000000001',
  true
);

select set_config(
  'test.phase1_group_id',
  (
    select id::text
    from public.create_canvas_group(
      '86000000-0000-0000-0000-000000000001'::uuid,
      'Legacy-compatible group',
      null
    )
  ),
  true
);

select set_config(
  'test.phase1_canvas_id',
  (
    select id::text
    from public.create_canvas(
      '86000000-0000-0000-0000-000000000001'::uuid,
      'Legacy-compatible Canvas',
      current_setting('test.phase1_group_id')::uuid
    )
  ),
  true
);

select lives_ok(
  $$ select * from public.rename_canvas_group(
    current_setting('test.phase1_group_id')::uuid,
    'Legacy-compatible group renamed'
  ) $$,
  'existing Canvas group RPC still works before Project-aware app rollout'
);

select lives_ok(
  $$ select * from public.rename_canvas(
    current_setting('test.phase1_canvas_id')::uuid,
    'Legacy-compatible Canvas renamed'
  ) $$,
  'existing Canvas RPC still works before Project-aware app rollout'
);

reset role;

select is(
  (
    select project_id
    from public.canvas_groups
    where id = current_setting('test.phase1_group_id')::uuid
  ),
  null::text,
  'legacy group creation is not forced into a guessed Project'
);
select is(
  (
    select project_id
    from public.canvases
    where id = current_setting('test.phase1_canvas_id')::uuid
  ),
  null::text,
  'legacy Canvas creation is not forced into a guessed Project'
);

select * from finish();
rollback;
