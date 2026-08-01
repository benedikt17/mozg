begin;

select no_plan();

select has_table('public', 'canvases', 'canvases table exists');
select has_table('public', 'canvas_view_states', 'canvas_view_states table exists');
select has_table('public', 'canvas_assets', 'canvas_assets table exists');
select has_function(
  'public',
  'create_canvas',
  array['uuid', 'text'],
  'Canvas create function exists'
);
select has_function(
  'public',
  'save_canvas_document',
  array['uuid', 'bigint', 'text', 'jsonb'],
  'Canvas CAS function exists'
);
select has_function(
  'public',
  'delete_canvas',
  array['uuid'],
  'Canvas soft-delete function exists'
);
select has_function(
  'public',
  'rename_canvas',
  array['uuid', 'text'],
  'Canvas rename function exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.canvases'::regclass),
  true,
  'canvases has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.canvas_view_states'::regclass),
  true,
  'canvas_view_states has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.canvas_assets'::regclass),
  true,
  'canvas_assets has RLS enabled'
);
select is(
  has_table_privilege('authenticated', 'public.canvases', 'UPDATE'),
  false,
  'authenticated clients cannot bypass Canvas CAS with direct update'
);
select is(
  has_table_privilege('authenticated', 'public.canvases', 'DELETE'),
  false,
  'authenticated clients cannot physically delete Canvases'
);
select is(
  has_function_privilege('anon', 'public.save_canvas_document(uuid,bigint,text,jsonb)', 'EXECUTE'),
  false,
  'anonymous clients cannot execute Canvas CAS'
);
select is(
  has_function_privilege('authenticated', 'public.save_canvas_document(uuid,bigint,text,jsonb)', 'EXECUTE'),
  true,
  'authenticated clients can execute Canvas CAS'
);
select is(
  has_function_privilege('anon', 'public.rename_canvas(uuid,text)', 'EXECUTE'),
  false,
  'anonymous clients cannot execute Canvas rename'
);
select is(
  has_function_privilege('authenticated', 'public.rename_canvas(uuid,text)', 'EXECUTE'),
  true,
  'authenticated clients can execute Canvas rename'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.rename_canvas(uuid,text)'::regprocedure),
  true,
  'Canvas rename uses SECURITY DEFINER'
);
select is(
  (select array_to_string(proconfig, ',') from pg_proc where oid = 'public.rename_canvas(uuid,text)'::regprocedure),
  'search_path=pg_catalog, public, private'::text,
  'Canvas rename pins a safe search_path'
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
  ('12000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'canvas-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('12000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'canvas-editor@example.test', '', now(), '{}', '{}', now(), now()),
  ('12000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'canvas-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('12000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'canvas-outsider@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name)
values
  ('22000000-0000-0000-0000-000000000001', 'Canvas workspace'),
  ('22000000-0000-0000-0000-000000000002', 'Other workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'owner'),
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002', 'editor'),
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000003', 'viewer'),
  ('22000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000001', 'owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ select * from public.create_canvas('22000000-0000-0000-0000-000000000099'::uuid, 'Denied') $$,
  '42501',
  'workspace access denied',
  'non-member cannot create a Canvas'
);

select set_config(
  'test.canvas_id',
  (select id::text from public.create_canvas('22000000-0000-0000-0000-000000000001'::uuid, ' First Canvas ')),
  true
);

select is(
  (select revision from public.canvases where id = current_setting('test.canvas_id')::uuid),
  1::bigint,
  'created Canvas starts at revision one'
);
select is(
  (select schema_version from public.canvases where id = current_setting('test.canvas_id')::uuid),
  2::smallint,
  'created Canvas uses schema version two'
);
select is(
  (select document from public.canvases where id = current_setting('test.canvas_id')::uuid),
  '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb,
  'created Canvas uses the canonical empty V2 document'
);
select results_eq(
  $$ select count(*)::bigint from public.canvases where workspace_id = '22000000-0000-0000-0000-000000000001' and deleted_at is null $$,
  array[1::bigint],
  'workspace member can read an active Canvas'
);

select set_config(
  'test.v2_document',
  $json$
  {
    "schemaVersion": 2,
    "nodes": [
      {"id":"task-1","kind":"task","taskId":"task-source","position":{"x":0,"y":0},"size":{"width":100,"height":100},"zIndex":0},
      {"id":"text-1","kind":"text","position":{"x":200,"y":0},"size":{"width":100,"height":100},"zIndex":1,"markdown":"  exact  "},
      {"id":"image-1","kind":"image","assetId":"asset-1","aspectRatioLocked":true,"position":{"x":400,"y":0},"size":{"width":100,"height":100},"zIndex":2},
      {"id":"article-1","kind":"article","articleId":"article-source","position":{"x":600,"y":0},"size":{"width":100,"height":100},"zIndex":3}
    ],
    "edges": [
      {"id":"edge-1","sourceNodeId":"task-1","sourceHandle":"top","targetNodeId":"text-1","targetHandle":"bottom","routing":"orthogonal","arrows":"none"},
      {"id":"edge-2","sourceNodeId":"text-1","sourceHandle":"right","targetNodeId":"image-1","targetHandle":"left","routing":"curved","arrows":"start"},
      {"id":"edge-3","sourceNodeId":"image-1","sourceHandle":"bottom","targetNodeId":"article-1","targetHandle":"top","routing":"straight","arrows":"end"},
      {"id":"edge-4","sourceNodeId":"article-1","sourceHandle":"left","targetNodeId":"task-1","targetHandle":"right","routing":"curved","arrows":"both"}
    ]
  }
  $json$,
  true
);

select throws_ok(
  $$ update public.canvases set title = 'bypass' where id = current_setting('test.canvas_id')::uuid $$,
  '42501',
  null,
  'direct Canvas update is denied'
);
select throws_ok(
  $$ delete from public.canvases where id = current_setting('test.canvas_id')::uuid $$,
  '42501',
  null,
  'direct Canvas delete is denied'
);

select results_eq(
  $$ select status || ':' || revision::text from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 1, 'Saved Canvas', current_setting('test.v2_document')::jsonb) $$,
  array['saved:2'::text],
  'valid Canvas CAS save succeeds'
);
select is(
  (select title from public.canvases where id = current_setting('test.canvas_id')::uuid),
  'Saved Canvas'::text,
  'Canvas CAS updates title atomically'
);
select is(
  (select document -> 'nodes' -> 1 ->> 'markdown' from public.canvases where id = current_setting('test.canvas_id')::uuid),
  '  exact  '::text,
  'Canvas CAS preserves exact Markdown'
);

select results_eq(
  $$ select status || ':' || revision::text from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 1, 'Stale title', current_setting('test.v2_document')::jsonb) $$,
  array['conflict:2'::text],
  'stale Canvas CAS returns the authoritative revision'
);
select is(
  (select title from public.canvases where id = current_setting('test.canvas_id')::uuid),
  'Saved Canvas'::text,
  'stale Canvas CAS cannot overwrite the winner'
);

select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Invalid', jsonb_set(current_setting('test.v2_document')::jsonb, '{nodes,1,future}', 'true'::jsonb)) $$,
  '22023',
  null,
  'unknown V2 node properties are rejected'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Invalid', '{"schemaVersion":1,"nodes":[],"edges":[]}'::jsonb) $$,
  '22023',
  'CanvasDocumentV2 validation failed',
  'V1 Canvas documents are rejected'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Invalid', jsonb_set(current_setting('test.v2_document')::jsonb, '{edges,0,targetNodeId}', '"missing"'::jsonb)) $$,
  '22023',
  'Canvas edge references a missing node',
  'dangling Canvas edges are rejected'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Invalid', jsonb_set(jsonb_set(current_setting('test.v2_document')::jsonb, '{edges,1,sourceNodeId}', '"task-1"'::jsonb), '{edges,1,targetNodeId}', '"text-1"'::jsonb)) $$,
  '22023',
  'duplicate Canvas edge endpoints',
  'duplicate Canvas edge endpoints are rejected'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Invalid', current_setting('test.v2_document')::jsonb || '{"future":true}'::jsonb) $$,
  '22023',
  'CanvasDocumentV2 validation failed',
  'unknown V2 top-level properties are rejected'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Invalid', current_setting('test.v2_document')::jsonb #- '{edges,0,routing}') $$,
  '22023',
  'invalid Canvas V2 edge',
  'missing V2 edge properties are rejected'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Invalid', jsonb_set(current_setting('test.v2_document')::jsonb, '{edges,0,routing}', '"elbow"'::jsonb)) $$,
  '22023',
  'invalid Canvas routing',
  'invalid V2 edge enums are rejected'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Invalid', jsonb_set(current_setting('test.v2_document')::jsonb, '{nodes,1,id}', '"task-1"'::jsonb)) $$,
  '22023',
  'duplicate Canvas node ID',
  'duplicate V2 node IDs are rejected'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Invalid', jsonb_set(current_setting('test.v2_document')::jsonb, '{edges,1,id}', '"edge-1"'::jsonb)) $$,
  '22023',
  'duplicate Canvas edge ID',
  'duplicate V2 edge IDs are rejected'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Invalid', jsonb_set(current_setting('test.v2_document')::jsonb, '{edges,0,targetNodeId}', '"task-1"'::jsonb)) $$,
  '22023',
  'Canvas self-edge is not allowed',
  'V2 self-connections are rejected'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Invalid', jsonb_set(current_setting('test.v2_document')::jsonb, '{nodes,0,id}', to_jsonb(repeat('😀', 129)))) $$,
  '22023',
  'invalid Canvas identifier',
  'Canvas identifier limits use UTF-16 code units'
);
select is(
  (select revision from public.canvases where id = current_setting('test.canvas_id')::uuid),
  2::bigint,
  'rejected Canvas saves do not increment revision'
);

reset role;
select is(
  (select count(*) from public.canvases where id = current_setting('test.canvas_id')::uuid),
  1::bigint,
  'Canvas row remains available to the database owner'
);
select throws_ok(
  $$ insert into public.canvases (id, workspace_id, title, schema_version, document, revision, created_by)
     values ('62000000-0000-0000-0000-000000000099'::uuid, '22000000-0000-0000-0000-000000000001'::uuid, 'V1 row', 1, '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb, 1, '12000000-0000-0000-0000-000000000001'::uuid) $$,
  '22023',
  'CanvasDocumentV2 validation failed',
  'rows with schema_version one are rejected'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Viewer Save', '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb) $$,
  '42501',
  'Canvas access denied',
  'viewer cannot save a Canvas'
);
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$ select status || ':' || revision::text from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 2, 'Editor Save', '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb) $$,
  array['saved:3'::text],
  'authorized editor can save the Canvas'
);
select results_eq(
  $$ select title || ':' || revision::text from public.rename_canvas(current_setting('test.canvas_id')::uuid, 'Renamed Canvas') $$,
  array['Renamed Canvas:3'::text],
  'authorized editor can rename the Canvas without changing document revision'
);
select throws_ok(
  $$ select * from public.rename_canvas(current_setting('test.canvas_id')::uuid, '   ') $$,
  '22023',
  'invalid Canvas title',
  'invalid Canvas rename titles are rejected'
);
select results_eq(
  $$ select count(*)::bigint from public.canvas_view_states $$,
  array[0::bigint],
  'editor has no unrelated view state rows'
);
select results_eq(
  $$ select deleted from public.delete_canvas(current_setting('test.canvas_id')::uuid) $$,
  array[true::boolean],
  'authorized editor can soft-delete the Canvas'
);
select results_eq(
  $$ select count(*)::bigint from public.canvases where id = current_setting('test.canvas_id')::uuid $$,
  array[0::bigint],
  'soft-deleted Canvas is excluded from the active policy'
);
select throws_ok(
  $$ select * from public.rename_canvas(current_setting('test.canvas_id')::uuid, 'After delete') $$,
  '42501',
  'Canvas access denied',
  'soft-deleted Canvas cannot be renamed'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.canvas_id')::uuid, 3, 'After delete', '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb) $$,
  '42501',
  'Canvas access denied',
  'soft-deleted Canvas cannot be saved'
);
select results_eq(
  $$ select deleted from public.delete_canvas(current_setting('test.canvas_id')::uuid) $$,
  array[false::boolean],
  'repeated Canvas deletion is idempotent'
);

reset role;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select set_config(
  'test.active_canvas_id',
  (select id::text from public.create_canvas('22000000-0000-0000-0000-000000000001'::uuid, 'View State Canvas')),
  true
);
select set_config(
  'test.other_canvas_id',
  (select id::text from public.create_canvas('22000000-0000-0000-0000-000000000002'::uuid, 'Other Workspace Canvas')),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select * from public.rename_canvas(current_setting('test.active_canvas_id')::uuid, 'Viewer Rename') $$,
  '42501',
  'Canvas access denied',
  'viewer cannot rename a Canvas'
);
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select * from public.rename_canvas(current_setting('test.active_canvas_id')::uuid, 'Outsider Rename') $$,
  '42501',
  'Canvas access denied',
  'non-member cannot rename a Canvas'
);
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ insert into public.canvas_view_states (canvas_id, user_id, viewport_x, viewport_y, zoom) values (current_setting('test.active_canvas_id')::uuid, (select auth.uid()), 10, 20, 1.5) $$,
  'member can insert their own Canvas view state'
);
select results_eq(
  $$ select viewport_x::text || ':' || viewport_y::text || ':' || zoom::text from public.canvas_view_states where canvas_id = current_setting('test.active_canvas_id')::uuid $$,
  array['10:20:1.5'::text],
  'member can read their own Canvas view state'
);
select lives_ok(
  $$ update public.canvas_view_states set viewport_x = 11, viewport_y = 21, zoom = 2 where canvas_id = current_setting('test.active_canvas_id')::uuid and user_id = (select auth.uid()) $$,
  'member can update their own Canvas view state'
);
select is(
  (select revision from public.canvases where id = current_setting('test.active_canvas_id')::uuid),
  1::bigint,
  'view-state writes do not increment Canvas revision'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*)::bigint from public.canvas_view_states where canvas_id = current_setting('test.active_canvas_id')::uuid),
  0::bigint,
  'another member cannot read a different user view state'
);
select lives_ok(
  $$ insert into public.canvas_view_states (canvas_id, user_id, viewport_x, viewport_y, zoom) values (current_setting('test.active_canvas_id')::uuid, (select auth.uid()), 1, 2, 1) $$,
  'another member can create their own isolated view state'
);
select is(
  (select count(*)::bigint from public.canvas_view_states where canvas_id = current_setting('test.active_canvas_id')::uuid and user_id = '12000000-0000-0000-0000-000000000001'::uuid),
  0::bigint,
  'another member cannot overwrite the owner view state'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000004', true);
select is(
  (select count(*)::bigint from public.canvases where id = current_setting('test.active_canvas_id')::uuid),
  0::bigint,
  'non-member cannot read a Canvas'
);
select is(
  (select count(*)::bigint from public.canvases where id = current_setting('test.other_canvas_id')::uuid),
  0::bigint,
  'member of another workspace cannot read this Canvas'
);
select is(
  (select count(*)::bigint from public.canvas_view_states where canvas_id = current_setting('test.active_canvas_id')::uuid),
  0::bigint,
  'non-member cannot read Canvas view state'
);
select throws_ok(
  $$ select * from public.save_canvas_document(current_setting('test.active_canvas_id')::uuid, 1, 'Outsider', '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb) $$,
  '42501',
  'Canvas access denied',
  'non-member cannot save a Canvas'
);

reset role;
insert into public.canvas_assets (
  id, workspace_id, storage_key, mime_type, byte_size, width, height, created_by
)
values (
  '62000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001/62000000-0000-0000-0000-000000000001/original',
  'image/png',
  1024,
  100,
  100,
  '12000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$ select storage_key from public.canvas_assets where id = '62000000-0000-0000-0000-000000000001' $$,
  array['22000000-0000-0000-0000-000000000001/62000000-0000-0000-0000-000000000001/original'::text],
  'workspace member can read Canvas asset metadata'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000004', true);
select results_eq(
  $$ select count(*)::bigint from public.canvas_assets where id = '62000000-0000-0000-0000-000000000001' $$,
  array[0::bigint],
  'non-member cannot read Canvas asset metadata'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$ select count(*)::bigint from public.canvases $$,
  '42501',
  null,
  'anonymous cannot read Canvases'
);
select throws_ok(
  $$ select * from public.create_canvas('22000000-0000-0000-0000-000000000001'::uuid, 'Anonymous') $$,
  '42501',
  'permission denied for function create_canvas',
  'anonymous cannot create a Canvas'
);

select * from finish();
rollback;
