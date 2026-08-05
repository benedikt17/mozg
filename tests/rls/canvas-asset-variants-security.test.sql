begin;

select no_plan();

select has_function(
  'public',
  'finalize_canvas_asset_variant',
  array['uuid', 'uuid', 'uuid', 'text'],
  'secured finalize function exists'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.finalize_canvas_asset_variant(uuid,uuid,uuid,text)'::regprocedure),
  true,
  'finalize remains SECURITY DEFINER'
);
select is(
  (select array_to_string(proconfig, ',') from pg_proc where oid = 'public.finalize_canvas_asset_variant(uuid,uuid,uuid,text)'::regprocedure),
  'search_path=pg_catalog, public, private'::text,
  'finalize pins a safe search_path'
);
select is(
  has_function_privilege('authenticated', 'public.finalize_canvas_asset_variant(uuid,uuid,uuid,text)', 'EXECUTE'),
  true,
  'authenticated clients retain the typed RPC grant'
);
select is(
  has_function_privilege('anon', 'public.finalize_canvas_asset_variant(uuid,uuid,uuid,text)', 'EXECUTE'),
  false,
  'anonymous clients do not receive the finalize RPC grant'
);
select has_function(
  'public',
  'reserve_canvas_asset_variant_v2',
  array['uuid', 'uuid', 'uuid', 'integer', 'bigint', 'integer', 'integer'],
  'numeric pyramid reserve function exists'
);
select has_function(
  'public',
  'finalize_canvas_asset_variant_v2',
  array['uuid', 'uuid', 'uuid', 'integer'],
  'numeric pyramid finalize function exists'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.reserve_canvas_asset_variant_v2(uuid,uuid,uuid,integer,bigint,integer,integer)'::regprocedure),
  true,
  'numeric pyramid reserve is SECURITY DEFINER'
);
select is(
  (select array_to_string(proconfig, ',') from pg_proc where oid = 'public.finalize_canvas_asset_variant_v2(uuid,uuid,uuid,integer)'::regprocedure),
  'search_path=pg_catalog, public, private'::text,
  'numeric pyramid finalize pins a safe search_path'
);
select is(
  has_function_privilege('authenticated', 'public.reserve_canvas_asset_variant_v2(uuid,uuid,uuid,integer,bigint,integer,integer)', 'EXECUTE'),
  true,
  'authenticated clients receive the numeric pyramid reserve grant'
);
select is(
  has_function_privilege('anon', 'public.reserve_canvas_asset_variant_v2(uuid,uuid,uuid,integer,bigint,integer,integer)', 'EXECUTE'),
  false,
  'anonymous clients do not receive the numeric pyramid reserve grant'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('72000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'variant-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('72000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'variant-editor@example.test', '', now(), '{}', '{}', now(), now()),
  ('72000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'variant-outsider@example.test', '', now(), '{}', '{}', now(), now()),
  ('72000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'variant-other-workspace@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name)
values
  ('82000000-0000-0000-0000-000000000001', 'Variant workspace'),
  ('82000000-0000-0000-0000-000000000002', 'Other variant workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'owner'),
  ('82000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002', 'editor'),
  ('82000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000004', 'owner');

insert into storage.buckets (id, name, public)
values ('canvas-assets', 'canvas-assets', false)
on conflict (id) do nothing;

insert into public.canvases (
  id, workspace_id, title, schema_version, document, revision, created_by
)
values
  ('82000000-0000-0000-0000-000000000011', '82000000-0000-0000-0000-000000000001', 'Variant canvas', 2, '{"schemaVersion":2,"nodes":[],"edges":[]}', 1, '72000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000012', '82000000-0000-0000-0000-000000000002', 'Other canvas', 2, '{"schemaVersion":2,"nodes":[],"edges":[]}', 1, '72000000-0000-0000-0000-000000000004');

insert into public.canvas_assets (
  id, workspace_id, canvas_id, storage_key, mime_type, byte_size,
  width, height, created_by, ready_at
)
values
  ('82000000-0000-0000-0000-000000000021', '82000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000011', '82000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000011/82000000-0000-0000-0000-000000000021/original', 'image/png', 1024, 100, 100, '72000000-0000-0000-0000-000000000001', now()),
  ('82000000-0000-0000-0000-000000000022', '82000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000011', '82000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000011/82000000-0000-0000-0000-000000000022/original', 'image/png', 1024, 100, 100, '72000000-0000-0000-0000-000000000001', now()),
  ('82000000-0000-0000-0000-000000000023', '82000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000011', '82000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000011/82000000-0000-0000-0000-000000000023/original', 'image/png', 1024, 100, 100, '72000000-0000-0000-0000-000000000001', now()),
  ('82000000-0000-0000-0000-000000000025', '82000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000011', '82000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000011/82000000-0000-0000-0000-000000000025/original', 'image/png', 1024, 1200, 400, '72000000-0000-0000-0000-000000000001', now()),
  ('82000000-0000-0000-0000-000000000024', '82000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000012', '82000000-0000-0000-0000-000000000002/82000000-0000-0000-0000-000000000012/82000000-0000-0000-0000-000000000024/original', 'image/png', 1024, 100, 100, '72000000-0000-0000-0000-000000000004', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$ select kind || ':' || (ready_at is null)::text from public.reserve_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000021'::uuid,
    'thumbnail', 128, 100, 100
  ) $$,
  array['thumbnail:true'::text],
  'authorized owner can reserve a variant'
);
select results_eq(
  $$ select kind || ':' || (ready_at is null)::text from public.reserve_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000025'::uuid,
    'thumbnail', 128, 512, 171
  ) $$,
  array['thumbnail:true'::text],
  'owner can reserve a rounded thumbnail at the aspect-ratio tolerance boundary'
);
reset role;
insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
values (
  gen_random_uuid(), 'canvas-assets',
  '82000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000011/82000000-0000-0000-0000-000000000021/thumbnail.webp',
  '72000000-0000-0000-0000-000000000001', '{"mimetype":"image/webp","size":128}', 'security-owner-version', '72000000-0000-0000-0000-000000000001', '{}'
);
set local role authenticated;
select results_eq(
  $$ select kind || ':' || (ready_at is not null)::text from public.finalize_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000021'::uuid,
    'thumbnail'
  ) $$,
  array['thumbnail:true'::text],
  'authorized owner can finalize a reserved variant'
);

select results_eq(
  $$ select kind || ':' || target_max_edge::text || ':' || (ready_at is null)::text from public.reserve_canvas_asset_variant_v2(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000021'::uuid,
    1024, 128, 100, 100
  ) $$,
  array['edge-1024:1024:true'::text],
  'authorized owner can reserve an open numeric pyramid tier'
);
reset role;
insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
values (
  gen_random_uuid(), 'canvas-assets',
  '82000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000011/82000000-0000-0000-0000-000000000021/edge-1024.webp',
  '72000000-0000-0000-0000-000000000001', '{"mimetype":"image/webp","size":128}', 'security-edge-version', '72000000-0000-0000-0000-000000000001', '{}'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$ select kind || ':' || target_max_edge::text || ':' || (ready_at is not null)::text from public.finalize_canvas_asset_variant_v2(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000021'::uuid,
    1024
  ) $$,
  array['edge-1024:1024:true'::text],
  'authorized owner can finalize an open numeric pyramid tier'
);
select is(
  (select target_max_edge from public.canvas_asset_variants
    where workspace_id = '82000000-0000-0000-0000-000000000001'::uuid
      and canvas_id = '82000000-0000-0000-0000-000000000011'::uuid
      and asset_id = '82000000-0000-0000-0000-000000000021'::uuid
      and kind = 'thumbnail'),
  512,
  'legacy thumbnail rows retain their canonical numeric tier'
);
select throws_ok(
  $$ select * from public.reserve_canvas_asset_variant_v2(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000021'::uuid,
    64, 128, 100, 100
  ) $$,
  '22023', 'Canvas asset variant metadata is invalid',
  'numeric pyramid reserve rejects dimensions that exceed its tier'
);
select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select * from public.reserve_canvas_asset_variant_v2(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000021'::uuid,
    2048, 100, 100, 100
  ) $$,
  '42501', 'Canvas asset variant access denied',
  'outsider cannot reserve a numeric pyramid tier'
);

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$ select kind || ':' || (ready_at is null)::text from public.reserve_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000022'::uuid,
    'preview', 256, 100, 100
  ) $$,
  array['preview:true'::text],
  'authorized workspace editor can reserve a variant'
);
reset role;
insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
values (
  gen_random_uuid(), 'canvas-assets',
  '82000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000011/82000000-0000-0000-0000-000000000022/preview.webp',
  '72000000-0000-0000-0000-000000000002', '{"mimetype":"image/webp","size":256}', 'security-editor-version', '72000000-0000-0000-0000-000000000002', '{}'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$ select kind || ':' || (ready_at is not null)::text from public.finalize_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000022'::uuid,
    'preview'
  ) $$,
  array['preview:true'::text],
  'authorized workspace member can finalize their reserved variant'
);

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$ select kind || ':' || (ready_at is null)::text from public.reserve_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000023'::uuid,
    'thumbnail', 128, 100, 100
  ) $$,
  array['thumbnail:true'::text],
  'owner can reserve the outsider test variant'
);
reset role;
set local role authenticated;

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select * from public.finalize_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000023'::uuid,
    'thumbnail'
  ) $$,
  '42501', 'Canvas asset variant access denied',
  'outsider cannot finalize a variant'
);

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select * from public.finalize_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000023'::uuid,
    'thumbnail'
  ) $$,
  '42501', 'Canvas asset variant access denied',
  'member of another workspace cannot finalize a foreign reservation'
);

select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select * from public.finalize_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000012'::uuid,
    '82000000-0000-0000-0000-000000000024'::uuid,
    'thumbnail'
  ) $$,
  '42501', 'Canvas asset variant access denied',
  'cross-workspace Canvas and asset identifiers are rejected'
);
select throws_ok(
  $$ select * from public.finalize_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000024'::uuid,
    'thumbnail'
  ) $$,
  '42501', 'Canvas asset variant access denied',
  'cross-workspace asset cannot be finalized through another Canvas'
);
select throws_ok(
  $$ select * from public.finalize_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000023'::uuid,
    'preview'
  ) $$,
  '42501', 'Canvas asset variant access denied',
  'foreign kind cannot finalize a thumbnail reservation'
);

reset role;
insert into storage.objects (id, bucket_id, name, owner, metadata, version, owner_id, user_metadata)
values (
  gen_random_uuid(), 'canvas-assets',
  '82000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000011/82000000-0000-0000-0000-000000000023/preview.webp',
  '72000000-0000-0000-0000-000000000001', '{"mimetype":"image/webp","size":128}', 'security-wrong-path-version', '72000000-0000-0000-0000-000000000001', '{}'
);
set local role authenticated;
select throws_ok(
  $$ select * from public.finalize_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000023'::uuid,
    'thumbnail'
  ) $$,
  '22023', 'Canvas asset variant object is missing',
  'a storage object at a different path cannot satisfy the reservation'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$ select * from public.finalize_canvas_asset_variant(
    '82000000-0000-0000-0000-000000000001'::uuid,
    '82000000-0000-0000-0000-000000000011'::uuid,
    '82000000-0000-0000-0000-000000000023'::uuid,
    'thumbnail'
  ) $$,
  '42501', 'permission denied for function finalize_canvas_asset_variant',
  'anonymous cannot invoke finalize even with a pending variant'
);

select * from finish();
rollback;
