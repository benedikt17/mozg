begin;

select no_plan();

select has_table('public', 'workspace_snapshots', 'workspace_snapshots table exists');
select has_function(
  'public',
  'save_workspace_snapshot',
  array['uuid', 'bigint', 'smallint', 'jsonb'],
  'CAS snapshot function exists'
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
  ('22000000-0000-0000-0000-000000000002', 'Disposable workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'owner'),
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002', 'editor'),
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000003', 'viewer'),
  ('22000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000001', 'owner');

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
select lives_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000001', '{"projects":[]}') $$,
  'owner can create the initial snapshot'
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
  $$ insert into public.workspace_snapshots (workspace_id, schema_version, snapshot) values ('22000000-0000-0000-0000-000000000001', 0, '{}') $$,
  '23514',
  null,
  'schema version must be positive'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, revision, snapshot) values ('22000000-0000-0000-0000-000000000001', 0, '{}') $$,
  '23514',
  null,
  'revision must be positive'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000002', '[]') $$,
  '23514',
  null,
  'snapshot must be a JSON object'
);
select throws_ok(
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000001', '{"projects":[]}') $$,
  '23505',
  null,
  'second initial insert cannot replace the existing snapshot'
);
select throws_ok(
  $$ update public.workspace_snapshots set workspace_id = '22000000-0000-0000-0000-000000000002' where workspace_id = '22000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'owner cannot bypass CAS to change snapshot workspace_id'
);
select results_eq(
  $$ select new_revision::text || ':' || (new_updated_at is not null)::text from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 1::bigint, 1::smallint, '{"projects":[{"id":"project-1"}]}'::jsonb) $$,
  array['2:true'::text],
  'owner CAS save succeeds, increments revision, and returns updated timestamp'
);
select is(
  (select snapshot->'projects'->0->>'id' from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  'project-1'::text,
  'successful CAS save stores the new snapshot'
);
select throws_ok(
  $$ select * from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 1::bigint, 1::smallint, '{"projects":[]}'::jsonb) $$,
  '40001',
  'snapshot revision conflict',
  'stale expected revision returns conflict without overwriting'
);
select throws_ok(
  $$ select * from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 1::bigint, 1::smallint, '{"projects":[]}'::jsonb) $$,
  '40001',
  'snapshot revision conflict',
  'repeated stale save returns conflict again'
);
select is(
  (select revision from public.workspace_snapshots where workspace_id = '22000000-0000-0000-0000-000000000001'),
  2::bigint,
  'conflict leaves server revision unchanged'
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
  $$ select * from public.save_workspace_snapshot('22000000-0000-0000-0000-000000000001'::uuid, 2::bigint, 1::smallint, '{"projects":[]}'::jsonb) $$,
  '42501',
  'workspace access denied',
  'editor cannot execute owner-only CAS save'
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
  $$ insert into public.workspace_snapshots (workspace_id, snapshot) values ('22000000-0000-0000-0000-000000000002', '{"projects":[]}') $$,
  'owner can create a snapshot in a second owned workspace'
);
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
