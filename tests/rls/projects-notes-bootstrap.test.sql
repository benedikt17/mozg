begin;

select no_plan();

select has_table('public', 'projects', 'projects table exists');
select has_table('public', 'notes', 'notes table exists');
select has_trigger(
  'auth',
  'users',
  'on_auth_user_created',
  'signup bootstrap trigger exists'
);
select is(
  (select prosecdef from pg_proc where oid = 'private.bootstrap_user_workspace(uuid)'::regprocedure),
  true,
  'bootstrap function is SECURITY DEFINER'
);
select is(
  (select prosecdef from pg_proc where oid = 'private.handle_new_user()'::regprocedure),
  true,
  'auth trigger function is SECURITY DEFINER'
);
select is(
  has_schema_privilege('authenticated', 'private', 'USAGE'),
  false,
  'untrusted clients cannot access bootstrap schema'
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
  ('11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'projects-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('11000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'projects-editor@example.test', '', now(), '{}', '{}', now(), now()),
  ('11000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'projects-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('11000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'projects-outsider@example.test', '', now(), '{}', '{}', now(), now());

select results_eq(
  $$
    select role
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
  $$,
  array['owner'::text],
  'signup creates exactly one owner membership'
);
select results_eq(
  $$
    select w.name
    from public.workspaces w
    join public.workspace_members wm on wm.workspace_id = w.id
    where wm.user_id = '11000000-0000-0000-0000-000000000001'
  $$,
  array['Личное пространство'::text],
  'signup creates a safely named personal workspace'
);
select is(
  private.bootstrap_user_workspace('11000000-0000-0000-0000-000000000001'),
  (select workspace_id from public.workspace_members where user_id = '11000000-0000-0000-0000-000000000001'),
  'repeated bootstrap returns the existing workspace'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
  $$,
  array[1::bigint],
  'repeated bootstrap does not create duplicates'
);

create function public.test_fail_bootstrap_membership()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.user_id = '11000000-0000-0000-0000-000000000005' then
    raise exception 'forced bootstrap failure';
  end if;
  return new;
end;
$$;

create trigger test_fail_bootstrap_membership
before insert on public.workspace_members
for each row execute function public.test_fail_bootstrap_membership();

select throws_ok(
  $$
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '11000000-0000-0000-0000-000000000005',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'bootstrap-failure@example.test', '',
      now(), '{}', '{}', now(), now()
    )
  $$,
  'P0001',
  'forced bootstrap failure',
  'bootstrap failure aborts signup'
);
select results_eq(
  $$ select count(*)::bigint from auth.users where id = '11000000-0000-0000-0000-000000000005' $$,
  array[0::bigint],
  'failed bootstrap leaves no auth user'
);
select results_eq(
  $$ select count(*)::bigint from public.workspaces $$,
  array[4::bigint],
  'failed bootstrap leaves no partial workspace'
);

drop trigger test_fail_bootstrap_membership on public.workspace_members;
drop function public.test_fail_bootstrap_membership();

select has_index('public', 'projects', 'projects_workspace_id_id_key', 'project composite unique index exists');
select has_index('public', 'notes', 'notes_project_title_unique', 'active title index exists');
select has_index('public', 'notes', 'notes_daily_unique', 'daily note index exists');
select has_index('public', 'notes', 'notes_share_token_unique', 'share token index exists');
select has_index('public', 'notes', 'notes_search_tsv_gin', 'FTS index exists');
select is(
  (
    select am.amname
    from pg_class i
    join pg_am am on am.oid = i.relam
    where i.oid = 'public.notes_search_tsv_gin'::regclass
  ),
  'gin',
  'search_tsv index uses GIN'
);
select is(
  (
    select attgenerated::text
    from pg_attribute
    where attrelid = 'public.notes'::regclass and attname = 'search_tsv'
  ),
  's',
  'search_tsv is a stored generated column'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notes'::regclass
      and contype = 'f'
      and confrelid = 'public.projects'::regclass
  ),
  'notes has a foreign key to projects'
);
select is(
  has_table_privilege('authenticated', 'public.projects', 'DELETE'),
  false,
  'projects cannot be physically deleted by clients'
);
select is(
  has_table_privilege('authenticated', 'public.notes', 'DELETE'),
  false,
  'notes cannot be physically deleted by clients'
);

insert into public.workspaces (id, name)
values ('21000000-0000-0000-0000-000000000002', 'Owner secondary workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'owner'),
  ((select workspace_id from public.workspace_members where user_id = '11000000-0000-0000-0000-000000000001' order by created_at limit 1), '11000000-0000-0000-0000-000000000002', 'editor'),
  ((select workspace_id from public.workspace_members where user_id = '11000000-0000-0000-0000-000000000001' order by created_at limit 1), '11000000-0000-0000-0000-000000000003', 'viewer');

insert into public.projects (id, workspace_id, name)
values ('31000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'Secondary project');

select set_config(
  'test.owner_workspace_id',
  (
    select workspace_id::text
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at
    limit 1
  ),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$
    insert into public.projects (id, workspace_id, name, emoji, color)
    select
      '31000000-0000-0000-0000-000000000001', workspace_id,
      'Основной проект', '🧭', '#336699'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  'owner can create a project'
);
select lives_ok(
  $$
    insert into public.notes (
      id, workspace_id, project_id, title, content_md
    )
    select
      '41000000-0000-0000-0000-000000000001', workspace_id,
      '31000000-0000-0000-0000-000000000001',
      ' Важная заметка ', 'быстрый brownfox_identifier'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  'owner can create a note'
);
select results_eq(
  $$
    select count(*)::bigint from public.notes
    where id = '41000000-0000-0000-0000-000000000001'
      and search_tsv @@ plainto_tsquery('russian', 'важная')
  $$,
  array[1::bigint],
  'russian FTS indexes note title'
);
select results_eq(
  $$
    select count(*)::bigint from public.notes
    where id = '41000000-0000-0000-0000-000000000001'
      and search_tsv @@ plainto_tsquery('simple', 'brownfox_identifier')
  $$,
  array[1::bigint],
  'simple FTS indexes technical identifiers'
);
select throws_ok(
  $$
    insert into public.notes (workspace_id, project_id, title)
    select workspace_id, '31000000-0000-0000-0000-000000000001', 'важная заметка'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  '23505',
  null,
  'normalized active note title is unique inside project'
);
select lives_ok(
  $$
    insert into public.notes (
      id, workspace_id, project_id, title, is_daily, daily_date
    )
    select
      '41000000-0000-0000-0000-000000000002', workspace_id,
      '31000000-0000-0000-0000-000000000001',
      'Daily 2026-07-11', true, '2026-07-11'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  'valid daily note can be created'
);
select throws_ok(
  $$
    insert into public.notes (workspace_id, project_id, title, is_daily, daily_date)
    select workspace_id, '31000000-0000-0000-0000-000000000001', 'Daily duplicate', true, '2026-07-11'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  '23505',
  null,
  'daily note date is unique inside project'
);
select throws_ok(
  $$
    insert into public.notes (workspace_id, project_id, title, is_daily)
    select workspace_id, '31000000-0000-0000-0000-000000000001', 'Invalid daily', true
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  '23514',
  null,
  'daily note requires daily_date'
);
select throws_ok(
  $$
    insert into public.notes (workspace_id, project_id, title, is_daily, daily_date)
    select workspace_id, '31000000-0000-0000-0000-000000000001', 'Invalid regular', false, '2026-07-12'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  '23514',
  null,
  'regular note cannot have daily_date'
);
select throws_ok(
  $$
    insert into public.notes (workspace_id, project_id, title, share_token)
    select workspace_id, '31000000-0000-0000-0000-000000000001',
      'Client share', '51000000-0000-0000-0000-000000000001'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  '42501',
  null,
  'client cannot create a note with share_token'
);
select lives_ok(
  $$
    update public.projects
    set name = 'Основной проект обновлён', updated_at = '2000-01-01'
    where id = '31000000-0000-0000-0000-000000000001'
  $$,
  'owner can update project'
);
select cmp_ok(
  (select updated_at from public.projects where id = '31000000-0000-0000-0000-000000000001'),
  '>',
  '2000-01-02'::timestamptz,
  'project updated_at trigger overrides client timestamp'
);
select lives_ok(
  $$
    update public.notes
    set content_md = 'обновлённый текст', updated_at = '2000-01-01'
    where id = '41000000-0000-0000-0000-000000000001'
  $$,
  'owner can update note'
);
select cmp_ok(
  (select updated_at from public.notes where id = '41000000-0000-0000-0000-000000000001'),
  '>',
  '2000-01-02'::timestamptz,
  'note updated_at trigger overrides client timestamp'
);
select throws_ok(
  $$ update public.projects set workspace_id = '21000000-0000-0000-0000-000000000002' where id = '31000000-0000-0000-0000-000000000001' $$,
  '23514',
  'workspace_id cannot be changed',
  'project workspace_id is immutable'
);
select throws_ok(
  $$ update public.notes set workspace_id = '21000000-0000-0000-0000-000000000002' where id = '41000000-0000-0000-0000-000000000001' $$,
  '23514',
  'workspace_id cannot be changed',
  'note workspace_id is immutable'
);
select throws_ok(
  $$
    insert into public.notes (workspace_id, project_id, title)
    select workspace_id, '31000000-0000-0000-0000-000000000002', 'Cross workspace'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  '23503',
  null,
  'composite FK rejects cross-workspace project relation'
);
select throws_ok(
  $$ update public.notes set project_id = '31000000-0000-0000-0000-000000000002' where id = '41000000-0000-0000-0000-000000000002' $$,
  '23503',
  null,
  'composite FK rejects cross-workspace project update'
);
select throws_ok(
  $$ update public.notes set share_token = '51000000-0000-0000-0000-000000000001' where id = '41000000-0000-0000-0000-000000000001' $$,
  '42501',
  'share_token can only be changed by a trusted server operation',
  'client cannot mutate share_token directly'
);
select lives_ok(
  $$ update public.notes set archived_at = now() where id = '41000000-0000-0000-0000-000000000001' $$,
  'owner can archive a note'
);
select lives_ok(
  $$
    insert into public.notes (id, workspace_id, project_id, title)
    select '41000000-0000-0000-0000-000000000003', workspace_id,
      '31000000-0000-0000-0000-000000000001', 'важная заметка'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  'archived title can be reused'
);
select results_eq(
  $$ select count(*)::bigint from public.notes where id = '41000000-0000-0000-0000-000000000001' $$,
  array[1::bigint],
  'owner can explicitly read an archived note'
);
select results_eq(
  $$ select count(*)::bigint from public.notes where archived_at is null and id = '41000000-0000-0000-0000-000000000001' $$,
  array[0::bigint],
  'active note query excludes archived note'
);
select lives_ok(
  $$
    insert into public.projects (id, workspace_id, name)
    select '31000000-0000-0000-0000-000000000004', workspace_id, 'Archived project'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  'owner can create project for archive test'
);
select lives_ok(
  $$ update public.projects set archived_at = now() where id = '31000000-0000-0000-0000-000000000004' $$,
  'owner can archive a project'
);
select results_eq(
  $$ select count(*)::bigint from public.projects where id = '31000000-0000-0000-0000-000000000004' $$,
  array[1::bigint],
  'owner can explicitly read archived project'
);
select results_eq(
  $$ select count(*)::bigint from public.projects where archived_at is null and id = '31000000-0000-0000-0000-000000000004' $$,
  array[0::bigint],
  'active project query excludes archived project'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$
    insert into public.projects (id, workspace_id, name)
    select '31000000-0000-0000-0000-000000000003', workspace_id, 'Editor project'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  'editor can create project'
);
select lives_ok(
  $$
    insert into public.notes (id, workspace_id, project_id, title)
    select '41000000-0000-0000-0000-000000000004', workspace_id,
      '31000000-0000-0000-0000-000000000003', 'Editor note'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  'editor can create note'
);
select lives_ok(
  $$ update public.notes set content_md = 'editor update' where id = '41000000-0000-0000-0000-000000000004' $$,
  'editor can update note'
);
select results_eq(
  $$ select count(*)::bigint from public.notes where id = '41000000-0000-0000-0000-000000000001' $$,
  array[0::bigint],
  'editor cannot read archived note'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$ select title from public.notes where id = '41000000-0000-0000-0000-000000000004' $$,
  array['Editor note'::text],
  'viewer can read active note'
);
select throws_ok(
  $$
    insert into public.projects (workspace_id, name)
    select workspace_id, 'Viewer project'
    from public.workspace_members
    where user_id = '11000000-0000-0000-0000-000000000001'
      and workspace_id <> '21000000-0000-0000-0000-000000000002'
    order by created_at limit 1
  $$,
  '42501',
  null,
  'viewer cannot create project'
);
select throws_ok(
  $$ update public.notes set content_md = 'viewer update' where id = '41000000-0000-0000-0000-000000000004' $$,
  '42501',
  null,
  'viewer cannot update note'
);
select results_eq(
  $$ select count(*)::bigint from public.notes where id = '41000000-0000-0000-0000-000000000001' $$,
  array[0::bigint],
  'viewer cannot read archived note'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000004', true);
select results_eq(
  $$ select count(*)::bigint from public.projects where id = '31000000-0000-0000-0000-000000000001' $$,
  array[0::bigint],
  'outsider cannot read project from another workspace'
);
select results_eq(
  $$ select count(*)::bigint from public.notes where id = '41000000-0000-0000-0000-000000000004' $$,
  array[0::bigint],
  'outsider cannot read note from another workspace'
);
select throws_ok(
  $$
    insert into public.projects (workspace_id, name)
    values (current_setting('test.owner_workspace_id')::uuid, 'Outsider project')
  $$,
  '42501',
  null,
  'outsider cannot create project in another workspace'
);
select throws_ok(
  $$
    insert into public.notes (workspace_id, project_id, title)
    values (
      current_setting('test.owner_workspace_id')::uuid,
      '31000000-0000-0000-0000-000000000001',
      'Outsider note'
    )
  $$,
  '42501',
  null,
  'outsider cannot create note in another workspace'
);
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select results_eq(
  $$ select count(*)::bigint from public.projects $$,
  array[0::bigint],
  'anonymous cannot read projects'
);
select results_eq(
  $$ select count(*)::bigint from public.notes $$,
  array[0::bigint],
  'anonymous cannot read notes'
);
reset role;

select * from finish();
rollback;
