begin;
select no_plan();
select has_table('public', 'knowledge_neuro_drafts', 'neuro draft staging table exists');
select is((select relrowsecurity from pg_class where oid = 'public.knowledge_neuro_drafts'::regclass), true, 'drafts use RLS');
select is(has_table_privilege('authenticated', 'public.knowledge_neuro_drafts', 'INSERT'), false, 'browser cannot create agent drafts');
select is(has_table_privilege('authenticated', 'public.knowledge_neuro_drafts', 'UPDATE'), false, 'browser cannot publish directly');
select is(has_function_privilege('authenticated', 'public.publish_knowledge_neuro_draft(uuid, uuid, integer)', 'EXECUTE'), false, 'browser cannot call privileged publisher');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('73000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'draft-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('73000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'draft-outsider@example.test', '', now(), '{}', '{}', now(), now());
select set_config('test.draft_workspace_id', (select workspace_id::text from public.workspace_members
  where user_id = '73000000-0000-0000-0000-000000000001' limit 1), true);
insert into public.knowledge_neuro_drafts (id, workspace_id, created_by, project_id, folder_path, documents)
values ('74000000-0000-0000-0000-000000000001', current_setting('test.draft_workspace_id')::uuid,
  '73000000-0000-0000-0000-000000000001', 'project-one', array['Стратегия'],
  '[{"title":"План","markdown":"# План","selected":true}]'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.knowledge_neuro_drafts
  where id = '74000000-0000-0000-0000-000000000001'), 1, 'owner sees own draft');
select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.knowledge_neuro_drafts
  where id = '74000000-0000-0000-0000-000000000001'), 0, 'other user cannot see owner draft');
reset role;

insert into public.workspace_snapshots (workspace_id, schema_version, snapshot)
values (current_setting('test.draft_workspace_id')::uuid, 3,
  '{"schemaVersion":3,"projects":[{"id":"project-one","name":"One","shortName":"One","description":""}],"overviewDirections":[],"taskGroups":[],"taskLists":[],"tasks":[],"knowledgeFolders":[],"documents":[]}'::jsonb);
select results_eq(
  $$select status from public.publish_knowledge_neuro_draft(
    '73000000-0000-0000-0000-000000000002',
    '74000000-0000-0000-0000-000000000001', 1)$$,
  array['conflict'::text], 'another user cannot publish the owner draft'
);
select results_eq(
  $$select status from public.publish_knowledge_neuro_draft(
    '73000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000001', 1)$$,
  array['published'::text], 'owner publishes selected Markdown'
);
select is((select snapshot #>> '{documents,0,title}' from public.workspace_snapshots
  where workspace_id = current_setting('test.draft_workspace_id')::uuid),
  'План', 'published document enters the main catalog');
select is((select snapshot #>> '{knowledgeFolders,0,path,0}' from public.workspace_snapshots
  where workspace_id = current_setting('test.draft_workspace_id')::uuid),
  'Стратегия', 'publication creates its folder');
select results_eq(
  $$select status from public.publish_knowledge_neuro_draft(
    '73000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000001', 1)$$,
  array['conflict'::text], 'draft cannot be published twice'
);
insert into public.knowledge_neuro_drafts (id, workspace_id, created_by, project_id, folder_path, documents)
values ('74000000-0000-0000-0000-000000000002', current_setting('test.draft_workspace_id')::uuid,
  '73000000-0000-0000-0000-000000000001', 'project-one', array['Стратегия'],
  '[{"title":"Один","markdown":"# Один","selected":true},{"title":"Два","markdown":"# Два","selected":false}]'::jsonb);
select results_eq(
  $$select status from public.publish_knowledge_neuro_draft(
    '73000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000002', 1)$$,
  array['published'::text], 'owner publishes selected subset'
);
select is((select documents -> 0 ->> 'title' from public.knowledge_neuro_drafts
  where id = '74000000-0000-0000-0000-000000000002'),
  'Два', 'unselected document remains in staging');
select is((select published_at is null from public.knowledge_neuro_drafts
  where id = '74000000-0000-0000-0000-000000000002'),
  true, 'partially published bundle stays open');
select * from finish();
rollback;
