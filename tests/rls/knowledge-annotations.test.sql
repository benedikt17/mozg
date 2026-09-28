begin;

select no_plan();

select has_table(
  'public',
  'knowledge_annotations',
  'knowledge annotations table exists'
);
select has_index(
  'public',
  'knowledge_annotations',
  'knowledge_annotations_document_idx',
  'document lookup index exists'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.knowledge_annotations'::regclass
  ),
  true,
  'knowledge annotations use RLS'
);
select is(
  has_table_privilege('authenticated', 'public.knowledge_annotations', 'DELETE'),
  false,
  'clients cannot physically delete annotations'
);
select is(
  has_function_privilege('authenticated', 'public.apply_knowledge_neurocomment(uuid, uuid)', 'EXECUTE'),
  false,
  'browser role cannot apply neurocomments through the privileged function'
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
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'annotation-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'annotation-editor@example.test', '', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'annotation-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'annotation-outsider@example.test', '', now(), '{}', '{}', now(), now());

select set_config(
  'test.annotation_workspace_id',
  (
    select workspace_id::text
    from public.workspace_members
    where user_id = '71000000-0000-0000-0000-000000000001'
    order by created_at
    limit 1
  ),
  true
);

insert into public.workspace_members (workspace_id, user_id, role)
values
  (current_setting('test.annotation_workspace_id')::uuid, '71000000-0000-0000-0000-000000000002', 'editor'),
  (current_setting('test.annotation_workspace_id')::uuid, '71000000-0000-0000-0000-000000000003', 'viewer');

insert into public.knowledge_annotations (
  id,
  workspace_id,
  document_id,
  created_by,
  selected_text,
  start_offset,
  end_offset,
  prefix,
  suffix,
  comment
)
values
  (
    '72000000-0000-0000-0000-000000000001',
    current_setting('test.annotation_workspace_id')::uuid,
    'doc-owner',
    '71000000-0000-0000-0000-000000000001',
    'owner quote',
    0,
    11,
    '',
    '',
    'owner comment'
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    current_setting('test.annotation_workspace_id')::uuid,
    'doc-owner',
    '71000000-0000-0000-0000-000000000002',
    'editor quote',
    12,
    24,
    '',
    '',
    'editor comment'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$
    select id
    from public.knowledge_annotations
    where workspace_id = current_setting('test.annotation_workspace_id')::uuid
    order by id
  $$,
  array['72000000-0000-0000-0000-000000000001'::uuid],
  'members see only their own annotations'
);

select lives_ok(
  $$
    insert into public.knowledge_annotations (
      workspace_id,
      document_id,
      selected_text,
      start_offset,
      end_offset,
      comment
    ) values (
      current_setting('test.annotation_workspace_id')::uuid,
      'doc-new',
      'new quote',
      0,
      9,
      'new comment'
    )
  $$,
  'owner can create an annotation using auth.uid as author'
);

select lives_ok(
  $$
    update public.knowledge_annotations
    set resolved_at = now()
    where id = '72000000-0000-0000-0000-000000000001'
  $$,
  'owner can resolve their annotation'
);

select throws_ok(
  $$
    insert into public.knowledge_annotations (
      workspace_id, document_id, selected_text, start_offset, end_offset,
      comment, kind, source_revision
    ) values (
      current_setting('test.annotation_workspace_id')::uuid,
      'doc-forged-ai', 'forged quote', 0, 12, 'forged AI comment', 'agent', 1
    )
  $$,
  '42501', null,
  'browser role cannot forge an agent comment'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$
    insert into public.knowledge_annotations (
      workspace_id,
      document_id,
      selected_text,
      start_offset,
      end_offset,
      comment
    ) values (
      current_setting('test.annotation_workspace_id')::uuid,
      'doc-viewer',
      'viewer quote',
      0,
      12,
      'viewer comment'
    )
  $$,
  '42501',
  null,
  'viewer cannot create annotations'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000004', true);
select results_eq(
  $$
    select count(*)::bigint
    from public.knowledge_annotations
    where workspace_id = current_setting('test.annotation_workspace_id')::uuid
  $$,
  array[0::bigint],
  'outsider cannot read workspace annotations'
);

reset role;

insert into public.workspace_snapshots (workspace_id, schema_version, snapshot)
values (
  current_setting('test.annotation_workspace_id')::uuid,
  3,
  '{"schemaVersion":3,"projects":[{"id":"project-a","name":"A","shortName":"A","description":""}],"overviewDirections":[],"taskGroups":[],"taskLists":[],"tasks":[],"knowledgeFolders":[],"documents":[{"id":"doc-ai","projectId":"project-a","folder":"","folderPath":[],"title":"Custom title","excerpt":"","content":["# Header","The old phrase stays."],"backlinks":[]}]}'::jsonb
);

insert into public.knowledge_annotations (
  id, workspace_id, document_id, created_by, selected_text,
  start_offset, end_offset, comment, kind, suggested_text, source_revision
) values (
  '72000000-0000-0000-0000-000000000003',
  current_setting('test.annotation_workspace_id')::uuid,
  'doc-ai', '71000000-0000-0000-0000-000000000001',
  'old phrase', 13, 23, 'Replace this phrase', 'agent', 'new phrase', 1
);

select results_eq(
  $$select status from public.apply_knowledge_neurocomment(
    '71000000-0000-0000-0000-000000000002',
    '72000000-0000-0000-0000-000000000003')$$,
  array['unavailable'::text],
  'a different user cannot accept an owner proposal'
);
select results_eq(
  $$select status from public.apply_knowledge_neurocomment(
    '71000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000003')$$,
  array['applied'::text],
  'the owner can accept an exact suggestion'
);
select is(
  (select snapshot #>> '{documents,0,content,1}' from public.workspace_snapshots
   where workspace_id = current_setting('test.annotation_workspace_id')::uuid),
  'The new phrase stays.',
  'only the quoted Markdown is replaced'
);
select is(
  (select snapshot #>> '{documents,0,title}' from public.workspace_snapshots
   where workspace_id = current_setting('test.annotation_workspace_id')::uuid),
  'Custom title',
  'the user-defined article title is preserved'
);
select is(
  (select revision from public.workspace_snapshots
   where workspace_id = current_setting('test.annotation_workspace_id')::uuid),
  2::bigint,
  'accepted suggestion increments snapshot revision'
);
select results_eq(
  $$select status from public.apply_knowledge_neurocomment(
    '71000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000003')$$,
  array['unavailable'::text],
  'an accepted suggestion cannot be applied twice'
);
insert into public.knowledge_annotations (
  id, workspace_id, document_id, created_by, selected_text,
  start_offset, end_offset, comment, kind, suggested_text, source_revision
) values (
  '72000000-0000-0000-0000-000000000004',
  current_setting('test.annotation_workspace_id')::uuid,
  'doc-ai', '71000000-0000-0000-0000-000000000001',
  'The', 9, 12, 'Now stale', 'agent', 'A', 1
);
select results_eq(
  $$select status from public.apply_knowledge_neurocomment(
    '71000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000004')$$,
  array['conflict'::text],
  'a changed snapshot rejects an old suggestion'
);

select * from finish();
rollback;
