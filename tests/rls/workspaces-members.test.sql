begin;

select plan(34);

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
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editor@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member@example.test', '', now(), '{}', '{}', now(), now());

-- Bootstrap behavior is covered separately in projects-notes-bootstrap.test.sql.
-- Remove automatic personal workspaces so this foundation test retains its
-- original isolated fixture and assertions.
delete from public.workspaces;

insert into public.workspaces (id, name)
values
  ('20000000-0000-0000-0000-000000000001', 'Primary workspace'),
  ('20000000-0000-0000-0000-000000000002', 'Last owner workspace'),
  ('20000000-0000-0000-0000-000000000003', 'Disposable workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'editor'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'viewer'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'owner');

select has_table('public', 'workspaces', 'workspaces table exists');
select has_table('public', 'workspace_members', 'workspace_members table exists');
select has_function('public', 'is_workspace_member', array['uuid'], 'membership helper exists');
select has_function('public', 'has_workspace_role', array['uuid', 'text[]'], 'role helper exists');
select is(
  (select prosecdef from pg_proc where oid = 'public.is_workspace_member(uuid)'::regprocedure),
  true,
  'membership helper is SECURITY DEFINER'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.has_workspace_role(uuid,text[])'::regprocedure),
  true,
  'role helper is SECURITY DEFINER'
);
select ok(
  (select array_to_string(proconfig, ',') = 'search_path=pg_catalog'
   from pg_proc where oid = 'public.is_workspace_member(uuid)'::regprocedure),
  'membership helper has a fixed safe search_path'
);
select ok(
  (select array_to_string(proconfig, ',') = 'search_path=pg_catalog'
   from pg_proc where oid = 'public.has_workspace_role(uuid,text[])'::regprocedure),
  'role helper has a fixed safe search_path'
);
select is(
  has_table_privilege('authenticated', 'public.workspaces', 'INSERT'),
  false,
  'authenticated clients cannot create workspaces before 1A-3 bootstrap'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  public.is_workspace_member('20000000-0000-0000-0000-000000000001'),
  false,
  'anonymous is not a workspace member'
);
select results_eq(
  $$ select count(*)::bigint from public.workspaces $$,
  array[0::bigint],
  'anonymous cannot read workspaces'
);
select throws_ok(
  $$ update public.workspaces set name = 'anonymous write' where id = '20000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'anonymous write is rejected by table privileges'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is(
  public.is_workspace_member('20000000-0000-0000-0000-000000000001'),
  true,
  'owner is a workspace member'
);
select is(
  public.has_workspace_role('20000000-0000-0000-0000-000000000001', array['owner']),
  true,
  'owner helper accepts owner role'
);
select is(
  public.has_workspace_role('20000000-0000-0000-0000-000000000001', array['editor', 'viewer']),
  false,
  'owner helper rejects unrelated roles'
);
select results_eq(
  $$ select count(*)::bigint from public.workspaces $$,
  array[3::bigint],
  'owner reads only owned/member workspaces'
);
select lives_ok(
  $$ update public.workspaces set name = 'Renamed workspace' where id = '20000000-0000-0000-0000-000000000001' $$,
  'owner can update a workspace'
);
select lives_ok(
  $$ insert into public.workspace_members (workspace_id, user_id, role) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'viewer') $$,
  'owner can add a member'
);
select lives_ok(
  $$ update public.workspace_members set role = 'editor' where workspace_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000005' $$,
  'owner can change a non-owner role'
);
select lives_ok(
  $$ delete from public.workspace_members where workspace_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000005' $$,
  'owner can remove a non-owner member'
);
select throws_ok(
  $$ delete from public.workspace_members where workspace_id = '20000000-0000-0000-0000-000000000002' and user_id = '10000000-0000-0000-0000-000000000001' $$,
  '23514',
  'the last workspace owner cannot be removed or demoted',
  'last owner cannot be deleted'
);
select throws_ok(
  $$ update public.workspace_members set role = 'editor' where workspace_id = '20000000-0000-0000-0000-000000000002' and user_id = '10000000-0000-0000-0000-000000000001' $$,
  '23514',
  'the last workspace owner cannot be removed or demoted',
  'last owner cannot be demoted'
);
select throws_ok(
  $$ update public.workspace_members set workspace_id = '20000000-0000-0000-0000-000000000002' where workspace_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000002' $$,
  '23514',
  'workspace_id of a membership cannot be changed',
  'membership cannot move between workspaces'
);
select lives_ok(
  $$ delete from public.workspaces where id = '20000000-0000-0000-0000-000000000003' $$,
  'owner can delete a workspace and cascade its membership'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$ select name from public.workspaces order by id $$,
  array['Renamed workspace'::text],
  'editor reads its workspace only'
);
select throws_ok(
  $$ update public.workspaces set name = 'editor write' where id = '20000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'editor workspace update is rejected by RLS'
);
select throws_ok(
  $$ update public.workspace_members set role = 'owner' where workspace_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000002' $$,
  '42501',
  null,
  'editor cannot promote itself to owner'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$ select count(*)::bigint from public.workspace_members $$,
  array[3::bigint],
  'viewer reads members of its workspace'
);
select throws_ok(
  $$ update public.workspaces set name = 'viewer write' where id = '20000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'viewer workspace update is rejected by RLS'
);
select throws_ok(
  $$ update public.workspace_members set role = 'editor' where workspace_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000003' $$,
  '42501',
  null,
  'viewer cannot change its role'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select is(
  public.is_workspace_member('20000000-0000-0000-0000-000000000001'),
  false,
  'outsider is not a workspace member'
);
select results_eq(
  $$ select count(*)::bigint from public.workspaces $$,
  array[0::bigint],
  'outsider cannot read workspaces'
);
select results_eq(
  $$ select count(*)::bigint from public.workspace_members $$,
  array[0::bigint],
  'outsider cannot read memberships'
);
select throws_ok(
  $$ insert into public.workspace_members (workspace_id, user_id, role) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'owner') $$,
  '42501',
  null,
  'outsider cannot join itself to a workspace'
);
reset role;

select * from finish();
rollback;
