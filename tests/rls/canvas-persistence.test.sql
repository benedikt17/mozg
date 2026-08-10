begin;

select no_plan();

select has_table('public', 'canvases', 'canvases table exists');
select has_table('public', 'canvas_view_states', 'canvas_view_states table exists');
select has_table('public', 'canvas_assets', 'canvas_assets table exists');
select has_table('public', 'canvas_asset_variants', 'canvas_asset_variants table exists');
select has_function(
  'public',
  'create_canvas_for_project',
  array['uuid', 'text', 'text', 'uuid'],
  'Project-scoped Canvas create function exists'
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
select has_function(
  'public',
  'reserve_canvas_asset',
  array['uuid', 'uuid', 'uuid', 'text', 'bigint', 'integer', 'integer', 'text'],
  'Canvas asset reserve function exists'
);
select has_function(
  'public',
  'finalize_canvas_asset',
  array['uuid', 'uuid', 'uuid'],
  'Canvas asset finalize function exists'
);
select has_function(
  'public',
  'delete_canvas_asset',
  array['uuid', 'uuid', 'uuid'],
  'Canvas asset delete function exists'
);
select has_function(
  'public',
  'reserve_canvas_asset_variant',
  array['uuid', 'uuid', 'uuid', 'text', 'bigint', 'integer', 'integer'],
  'Canvas asset variant reserve function exists'
);
select has_function(
  'public',
  'finalize_canvas_asset_variant',
  array['uuid', 'uuid', 'uuid', 'text'],
  'Canvas asset variant finalize function exists'
);
select is(
  (select count(*)::bigint from information_schema.columns where table_schema = 'public' and table_name = 'canvas_assets' and column_name = 'canvas_id'),
  1::bigint,
  'canvas_assets is Canvas-scoped'
);
select is(
  (select public from storage.buckets where id = 'canvas-assets'),
  false,
  'Canvas asset bucket is private'
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
  (select relrowsecurity from pg_class where oid = 'public.canvas_asset_variants'::regclass),
  true,
  'canvas_asset_variants has RLS enabled'
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
  has_table_privilege('authenticated', 'public.canvas_assets', 'INSERT'),
  false,
  'authenticated clients cannot bypass asset reserve RPC with direct insert'
);
select is(
  has_table_privilege('authenticated', 'public.canvas_assets', 'UPDATE'),
  false,
  'authenticated clients cannot bypass asset lifecycle with direct update'
);
select is(
  has_table_privilege('authenticated', 'public.canvas_assets', 'DELETE'),
  false,
  'authenticated clients cannot bypass asset lifecycle with direct delete'
);
select is(
  has_table_privilege('authenticated', 'public.canvas_asset_variants', 'INSERT'),
  false,
  'authenticated clients cannot bypass variant reserve RPC with direct insert'
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
  $$ select * from public.create_canvas_for_project('22000000-0000-0000-0000-000000000099'::uuid, 'project-denied', 'Denied', null) $$,
  '42501',
  'workspace access denied',
  'non-member cannot create a Canvas'
);

select set_config(
  'test.canvas_id',
  (select id::text from public.create_canvas_for_project('22000000-0000-0000-0000-000000000001'::uuid, 'project-a', ' First Canvas ', null)),
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

select set_config('test.asset_id', '62000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$ select id::text || ':' || coalesce(ready_at::text, 'pending') from public.reserve_canvas_asset(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.canvas_id')::uuid,
    current_setting('test.asset_id')::uuid,
    'image/png',
    1024,
    100,
    100
  ) $$,
  array['62000000-0000-0000-0000-000000000001:pending'::text],
  'owner can reserve Canvas asset metadata'
);
select lives_ok(
  $$ insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
     values (
       gen_random_uuid(),
       'canvas-assets',
       '22000000-0000-0000-0000-000000000001/' || current_setting('test.canvas_id') || '/62000000-0000-0000-0000-000000000001/original',
       (select auth.uid()),
       '{"mimetype":"image/png","size":1024}'::jsonb,
       'test-version',
       (select auth.uid())::text,
       '{}'::jsonb
     ) $$,
  'write-capable member can upload only a reserved asset object'
);
select results_eq(
  $$ select id::text || ':' || (ready_at is not null)::text from public.finalize_canvas_asset(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.canvas_id')::uuid,
    current_setting('test.asset_id')::uuid
  ) $$,
  array['62000000-0000-0000-0000-000000000001:true'::text],
  'owner can finalize an uploaded Canvas asset'
);

select results_eq(
  $$ select kind || ':' || (ready_at is null)::text from public.reserve_canvas_asset_variant(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.canvas_id')::uuid,
    current_setting('test.asset_id')::uuid,
    'thumbnail',
    128,
    100,
    100
  ) $$,
  array['thumbnail:true'::text],
  'owner can reserve a thumbnail variant'
);
select lives_ok(
  $$ insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
     values (
       gen_random_uuid(),
       'canvas-assets',
       '22000000-0000-0000-0000-000000000001/' || current_setting('test.canvas_id') || '/' || current_setting('test.asset_id') || '/thumbnail.webp',
       (select auth.uid()),
       '{"mimetype":"image/webp","size":128}'::jsonb,
       'variant-test-version',
       (select auth.uid())::text,
       '{}'::jsonb
     ) $$,
  'write-capable member can upload only a reserved variant object'
);
select results_eq(
  $$ select kind || ':' || (ready_at is not null)::text from public.finalize_canvas_asset_variant(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.canvas_id')::uuid,
    current_setting('test.asset_id')::uuid,
    'thumbnail'
  ) $$,
  array['thumbnail:true'::text],
  'owner can finalize a variant after upload'
);
select results_eq(
  $$ select count(*)::bigint from public.canvas_asset_variants $$,
  array[1::bigint],
  'variant metadata count is exact after one finalized variant'
);
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$ select count(*)::bigint from public.canvas_asset_variants $$,
  array[1::bigint],
  'workspace viewer can read a ready variant'
);
select results_eq(
  $$ select count(*)::bigint from storage.objects where bucket_id = 'canvas-assets' and name like '%/thumbnail.webp' $$,
  array[1::bigint],
  'workspace viewer can read the ready variant object'
);
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000004', true);
select results_eq(
  $$ select count(*)::bigint from public.canvas_asset_variants $$,
  array[0::bigint],
  'outsider cannot read another workspace variant'
);
select results_eq(
  $$ select count(*)::bigint from storage.objects where bucket_id = 'canvas-assets' and name like '%/thumbnail.webp' $$,
  array[0::bigint],
  'outsider cannot read another workspace variant object'
);
select throws_ok(
  $$ insert into public.canvas_asset_variants (workspace_id, canvas_id, asset_id, kind, storage_path, mime_type, byte_size, pixel_width, pixel_height)
     values ('22000000-0000-0000-0000-000000000001'::uuid, current_setting('test.canvas_id')::uuid, current_setting('test.asset_id')::uuid, 'preview', 'invalid', 'image/webp', 128, 100, 100) $$,
  '42501',
  null,
  'authenticated clients cannot directly insert variant metadata'
);
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$ select count(*)::bigint from public.reserve_canvas_asset_variant(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.canvas_id')::uuid,
    current_setting('test.asset_id')::uuid,
    'thumbnail',
    128,
    100,
    100
  ) $$,
  array[1::bigint],
  'repeated variant reserve is idempotent'
);
select throws_ok(
  $$ select * from public.reserve_canvas_asset_variant(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.canvas_id')::uuid,
    current_setting('test.asset_id')::uuid,
    'preview', 128, 101, 100
  ) $$,
  '22023',
  'Canvas asset variant dimensions do not match the original asset',
  'variant reserve rejects an upscale beyond the original asset'
);

select set_config(
  'test.v2_document',
  $json$
  {
    "schemaVersion": 2,
    "nodes": [
      {"id":"task-1","kind":"task","taskId":"task-source","position":{"x":0,"y":0},"size":{"width":100,"height":100},"zIndex":0},
      {"id":"text-1","kind":"text","position":{"x":200,"y":0},"size":{"width":100,"height":100},"zIndex":1,"markdown":"  exact  "},
      {"id":"image-1","kind":"image","assetId":"62000000-0000-0000-0000-000000000001","aspectRatioLocked":true,"position":{"x":400,"y":0},"size":{"width":100,"height":100},"zIndex":2},
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
  $$ insert into public.canvases (id, workspace_id, project_id, title, schema_version, document, revision, created_by)
     values ('62000000-0000-0000-0000-000000000099'::uuid, '22000000-0000-0000-0000-000000000001'::uuid, 'project-a', 'V1 row', 1, '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb, 1, '12000000-0000-0000-0000-000000000001'::uuid) $$,
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
  (select id::text from public.create_canvas_for_project('22000000-0000-0000-0000-000000000001'::uuid, 'project-a', 'View State Canvas', null)),
  true
);
select set_config(
  'test.other_canvas_id',
  (select id::text from public.create_canvas_for_project('22000000-0000-0000-0000-000000000002'::uuid, 'project-b', 'Other Workspace Canvas', null)),
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
set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select set_config('test.active_asset_id', '62000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$ select id::text || ':' || coalesce(ready_at::text, 'pending') from public.reserve_canvas_asset(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.active_canvas_id')::uuid,
    current_setting('test.active_asset_id')::uuid,
    'image/png',
    1024,
    100,
    100
  ) $$,
  array['62000000-0000-0000-0000-000000000002:pending'::text],
  'owner can reserve an active Canvas asset'
);
select lives_ok(
  $$ insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
     values (
       gen_random_uuid(),
       'canvas-assets',
       '22000000-0000-0000-0000-000000000001/' || current_setting('test.active_canvas_id') || '/62000000-0000-0000-0000-000000000002/original',
       (select auth.uid()),
       '{"mimetype":"image/png","size":1024}'::jsonb,
       'test-version-active',
       (select auth.uid())::text,
       '{}'::jsonb
     ) $$,
  'owner can upload an active Canvas asset object'
);
select results_eq(
  $$ select id::text || ':' || (ready_at is not null)::text from public.finalize_canvas_asset(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.active_canvas_id')::uuid,
    current_setting('test.active_asset_id')::uuid
  ) $$,
  array['62000000-0000-0000-0000-000000000002:true'::text],
  'owner can finalize an active Canvas asset'
);
select results_eq(
  $$ select storage_key from public.canvas_assets where id = current_setting('test.active_asset_id')::uuid $$,
  array['22000000-0000-0000-0000-000000000001/' || current_setting('test.active_canvas_id') || '/62000000-0000-0000-0000-000000000002/original'::text],
  'workspace member can read Canvas asset metadata'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*)::bigint from public.canvas_assets where id = current_setting('test.active_asset_id')::uuid),
  1::bigint,
  'viewer can read ready asset metadata for a Canvas they can read'
);
select is(
  (select count(*)::bigint from storage.objects where bucket_id = 'canvas-assets' and name like '%/62000000-0000-0000-0000-000000000002/original'),
  1::bigint,
  'viewer can read the ready Canvas asset object'
);
select throws_ok(
  $$ insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
     values (gen_random_uuid(), 'canvas-assets', '22000000-0000-0000-0000-000000000001/' || current_setting('test.active_canvas_id') || '/62000000-0000-0000-0000-000000000099/original', (select auth.uid()), '{}'::jsonb, 'viewer-version', (select auth.uid())::text, '{}'::jsonb) $$,
  '42501',
  null,
  'viewer cannot upload Canvas asset objects'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000004', true);
select results_eq(
  $$ select count(*)::bigint from public.canvas_assets where id = current_setting('test.active_asset_id')::uuid $$,
  array[0::bigint],
  'non-member cannot read Canvas asset metadata'
);
select is(
  (select count(*)::bigint from storage.objects where bucket_id = 'canvas-assets' and name like '%/62000000-0000-0000-0000-000000000002/original'),
  0::bigint,
  'non-member cannot read Canvas asset objects'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select set_config(
  'test.active_asset_document',
  '{"schemaVersion":2,"nodes":[{"id":"image-active","kind":"image","assetId":"62000000-0000-0000-0000-000000000002","aspectRatioLocked":true,"position":{"x":0,"y":0},"size":{"width":100,"height":100},"zIndex":0}],"edges":[]}',
  true
);
select results_eq(
  $$ select status || ':' || revision::text from public.save_canvas_document(
    current_setting('test.active_canvas_id')::uuid,
    1,
    'Active Canvas With Image',
    current_setting('test.active_asset_document')::jsonb
  ) $$,
  array['saved:2'::text],
  'same-Canvas ready asset reference is accepted by Canvas CAS'
);
select throws_ok(
  $$ select * from public.save_canvas_document(
    current_setting('test.active_canvas_id')::uuid,
    2,
    'Missing Asset',
    jsonb_set(current_setting('test.active_asset_document')::jsonb, '{nodes,0,assetId}', '"62000000-0000-0000-0000-000000000099"'::jsonb)
  ) $$,
  '22023',
  'Canvas image references an unavailable asset',
  'missing asset references are rejected atomically'
);
select set_config('test.pending_asset_id', '62000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$ select id::text || ':' || coalesce(ready_at::text, 'pending') from public.reserve_canvas_asset(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.active_canvas_id')::uuid,
    current_setting('test.pending_asset_id')::uuid,
    'image/png',
    1024,
    100,
    100
  ) $$,
  array['62000000-0000-0000-0000-000000000003:pending'::text],
  'pending asset metadata is not finalized'
);
select throws_ok(
  $$ select * from public.save_canvas_document(
    current_setting('test.active_canvas_id')::uuid,
    2,
    'Pending Asset',
    jsonb_set(current_setting('test.active_asset_document')::jsonb, '{nodes,0,assetId}', to_jsonb(current_setting('test.pending_asset_id')))
  ) $$,
  '22023',
  'Canvas image references an unavailable asset',
  'pending asset references are rejected'
);

select set_config(
  'test.same_workspace_canvas_id',
  (select id::text from public.create_canvas_for_project('22000000-0000-0000-0000-000000000001'::uuid, 'project-a', 'Second Canvas', null)),
  true
);
select results_eq(
  $$ select id::text || ':' || coalesce(ready_at::text, 'pending') from public.reserve_canvas_asset(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.same_workspace_canvas_id')::uuid,
    '62000000-0000-0000-0000-000000000004'::uuid,
    'image/png',
    1024,
    100,
    100
  ) $$,
  array['62000000-0000-0000-0000-000000000004:pending'::text],
  'owner can reserve an asset for a second Canvas in the workspace'
);
select lives_ok(
  $$ insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
     values (
       gen_random_uuid(),
       'canvas-assets',
       '22000000-0000-0000-0000-000000000001/' || current_setting('test.same_workspace_canvas_id') || '/62000000-0000-0000-0000-000000000004/original',
       (select auth.uid()), '{"mimetype":"image/png","size":1024}'::jsonb,
       'same-canvas-version', (select auth.uid())::text, '{}'::jsonb
     ) $$,
  'owner can upload the second Canvas asset object'
);
select lives_ok(
  $$ select * from public.finalize_canvas_asset('22000000-0000-0000-0000-000000000001'::uuid, current_setting('test.same_workspace_canvas_id')::uuid, '62000000-0000-0000-0000-000000000004'::uuid) $$,
  'owner can finalize the second Canvas asset'
);
select throws_ok(
  $$ select * from public.save_canvas_document(
    current_setting('test.active_canvas_id')::uuid,
    2,
    'Other Canvas Asset',
    jsonb_set(current_setting('test.active_asset_document')::jsonb, '{nodes,0,assetId}', '"62000000-0000-0000-0000-000000000004"'::jsonb)
  ) $$,
  '22023',
  'Canvas image references an unavailable asset',
  'asset references from another Canvas are rejected'
);

select results_eq(
  $$ select id::text || ':' || coalesce(ready_at::text, 'pending') from public.reserve_canvas_asset(
    '22000000-0000-0000-0000-000000000002'::uuid,
    current_setting('test.other_canvas_id')::uuid,
    '62000000-0000-0000-0000-000000000005'::uuid,
    'image/png',
    1024,
    100,
    100
  ) $$,
  array['62000000-0000-0000-0000-000000000005:pending'::text],
  'owner can reserve an asset in another workspace'
);
select lives_ok(
  $$ insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
     values (
       gen_random_uuid(),
       'canvas-assets',
       '22000000-0000-0000-0000-000000000002/' || current_setting('test.other_canvas_id') || '/62000000-0000-0000-0000-000000000005/original',
       (select auth.uid()), '{"mimetype":"image/png","size":1024}'::jsonb,
       'other-workspace-version', (select auth.uid())::text, '{}'::jsonb
     ) $$,
  'owner can upload the other workspace asset object'
);
select lives_ok(
  $$ select * from public.finalize_canvas_asset('22000000-0000-0000-0000-000000000002'::uuid, current_setting('test.other_canvas_id')::uuid, '62000000-0000-0000-0000-000000000005'::uuid) $$,
  'owner can finalize the other workspace asset'
);
select throws_ok(
  $$ select * from public.save_canvas_document(
    current_setting('test.active_canvas_id')::uuid,
    2,
    'Other Workspace Asset',
    jsonb_set(current_setting('test.active_asset_document')::jsonb, '{nodes,0,assetId}', '"62000000-0000-0000-0000-000000000005"'::jsonb)
  ) $$,
  '22023',
  'Canvas image references an unavailable asset',
  'asset references from another workspace are rejected'
);

select results_eq(
  $$ select deleted::text from public.delete_canvas_asset('22000000-0000-0000-0000-000000000001'::uuid, current_setting('test.active_canvas_id')::uuid, current_setting('test.active_asset_id')::uuid) $$,
  array['true'::text],
  'owner can soft-delete asset metadata'
);
select is(
  (select count(*)::bigint from storage.objects where bucket_id = 'canvas-assets' and name like '%/62000000-0000-0000-0000-000000000002/original'),
  0::bigint,
  'soft-deleted asset object is no longer readable through Storage policy'
);
select throws_ok(
  $$ select * from public.save_canvas_document(
    current_setting('test.active_canvas_id')::uuid,
    2,
    'Deleted Asset',
    current_setting('test.active_asset_document')::jsonb
  ) $$,
  '22023',
  'Canvas image references an unavailable asset',
  'deleted asset references are rejected'
);
select results_eq(
  $$ select status || ':' || revision::text from public.save_canvas_document(current_setting('test.active_canvas_id')::uuid, 2, 'Text Only', '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb) $$,
  array['saved:3'::text],
  'non-image Canvas documents remain saveable without assets'
);

select set_config('test.cleanup_asset_id', '62000000-0000-0000-0000-000000000006', true);
select lives_ok(
  $$ select * from public.reserve_canvas_asset(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.active_canvas_id')::uuid,
    current_setting('test.cleanup_asset_id')::uuid,
    'image/png', 1024, 100, 100
  ) $$,
  'owner can reserve an asset for variant cleanup'
);
select lives_ok(
  $$ insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
     values (gen_random_uuid(), 'canvas-assets',
       '22000000-0000-0000-0000-000000000001/' || current_setting('test.active_canvas_id') || '/' || current_setting('test.cleanup_asset_id') || '/original',
       (select auth.uid()), '{"mimetype":"image/png","size":1024}'::jsonb, 'cleanup-original-version', (select auth.uid())::text, '{}'::jsonb) $$,
  'owner can upload the cleanup asset object'
);
select lives_ok(
  $$ select * from public.finalize_canvas_asset('22000000-0000-0000-0000-000000000001'::uuid, current_setting('test.active_canvas_id')::uuid, current_setting('test.cleanup_asset_id')::uuid) $$,
  'owner can finalize the cleanup asset'
);
select lives_ok(
  $$ select * from public.reserve_canvas_asset_variant(
    '22000000-0000-0000-0000-000000000001'::uuid,
    current_setting('test.active_canvas_id')::uuid,
    current_setting('test.cleanup_asset_id')::uuid,
    'thumbnail', 128, 100, 100
  ) $$,
  'owner can reserve a cleanup variant'
);
select lives_ok(
  $$ insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
     values (gen_random_uuid(), 'canvas-assets',
       '22000000-0000-0000-0000-000000000001/' || current_setting('test.active_canvas_id') || '/' || current_setting('test.cleanup_asset_id') || '/thumbnail.webp',
       (select auth.uid()), '{"mimetype":"image/webp","size":128}'::jsonb, 'cleanup-variant-version', (select auth.uid())::text, '{}'::jsonb) $$,
  'owner can upload the cleanup variant object'
);
select lives_ok(
  $$ select * from public.finalize_canvas_asset_variant('22000000-0000-0000-0000-000000000001'::uuid, current_setting('test.active_canvas_id')::uuid, current_setting('test.cleanup_asset_id')::uuid, 'thumbnail') $$,
  'owner can finalize the cleanup variant'
);
select results_eq(
  $$ select deleted::text from public.delete_canvas_asset('22000000-0000-0000-0000-000000000001'::uuid, current_setting('test.active_canvas_id')::uuid, current_setting('test.cleanup_asset_id')::uuid) $$,
  array['true'::text],
  'asset deletion succeeds with a ready variant'
);
select results_eq(
  $$ select count(*)::bigint from public.canvas_asset_variants where asset_id = current_setting('test.cleanup_asset_id')::uuid $$,
  array[0::bigint],
  'asset deletion removes variant metadata'
);
select results_eq(
  $$ select count(*)::bigint from storage.objects where bucket_id = 'canvas-assets' and name like '%' || current_setting('test.cleanup_asset_id') || '/thumbnail.webp' $$,
  array[0::bigint],
  'asset deletion hides the orphaned variant object from the storage policy'
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
  $$ select * from public.create_canvas_for_project('22000000-0000-0000-0000-000000000001'::uuid, 'project-a', 'Anonymous', null) $$,
  '42501',
  'permission denied for function create_canvas_for_project',
  'anonymous cannot create a Canvas'
);

select * from finish();
rollback;
