begin;

select no_plan();

select has_table('public', 'project_folders', 'Project folders table exists');
select has_table('public', 'project_files', 'Project files table exists');
select has_table('public', 'file_variants', 'File variants table exists');
select has_function(
  'public',
  'reserve_project_file',
  array['uuid', 'text', 'uuid', 'text', 'text', 'text', 'bigint', 'uuid', 'integer', 'integer', 'text'],
  'typed Project file reserve RPC exists'
);
select has_function('public', 'finalize_project_file', array['uuid'], 'typed Project file finalize RPC exists');
select is(
  (select prosecdef from pg_proc where oid = 'public.reserve_project_file(uuid,text,uuid,text,text,text,bigint,uuid,integer,integer,text)'::regprocedure),
  true,
  'reserve RPC is SECURITY DEFINER'
);
select is(
  (select array_to_string(proconfig, ',') from pg_proc where oid = 'public.reserve_project_file(uuid,text,uuid,text,text,text,bigint,uuid,integer,integer,text)'::regprocedure),
  'search_path=pg_catalog, public, private'::text,
  'reserve RPC pins a safe search_path'
);
select is(
  has_function_privilege('authenticated', 'public.reserve_project_file(uuid,text,uuid,text,text,text,bigint,uuid,integer,integer,text)', 'EXECUTE'),
  true,
  'authenticated clients receive reserve RPC access'
);
select is(
  has_function_privilege('anon', 'public.reserve_project_file(uuid,text,uuid,text,text,text,bigint,uuid,integer,integer,text)', 'EXECUTE'),
  false,
  'anonymous clients cannot reserve Project files'
);

select is(has_table_privilege('authenticated', 'public.project_files', 'SELECT'), true, 'authenticated clients may read metadata through RLS');
select is(has_table_privilege('authenticated', 'public.project_files', 'INSERT'), false, 'authenticated clients cannot bypass reserve RPC');
select is(has_table_privilege('authenticated', 'public.project_files', 'UPDATE'), false, 'authenticated clients cannot mutate file identity directly');
select is(has_table_privilege('authenticated', 'public.project_files', 'DELETE'), false, 'authenticated clients cannot physically delete file metadata');

select results_eq(
  $$ select id || ':' || public::text || ':' || file_size_limit::text from storage.buckets where id = 'project-files' $$,
  array['project-files:false:52428800'::text],
  'Project Files bucket is private with its own 50 MB Stage A limit'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_files' and policyname = 'project_files_select_member'),
  'Project file metadata RLS policy exists'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'project_files_storage_select' and cmd = 'SELECT'),
  'private Storage SELECT policy exists'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'project_files_storage_insert' and cmd = 'INSERT'),
  'private Storage INSERT policy exists'
);
select ok(
  not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'project_files_storage%' and cmd = 'DELETE'),
  'Stage A exposes no client-side physical Storage delete policy'
);

select * from finish();
rollback;
