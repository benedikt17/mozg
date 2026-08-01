-- CanvasDocumentV2 is the first cloud-canonical Canvas contract.
-- The previous Canvas foundation is intentionally left unchanged. This
-- migration fails closed if it is ever applied to a database containing
-- Canvas rows from that V1-only foundation.

do $$
begin
  if exists (
    select 1
    from public.canvases
    where schema_version is distinct from 2
       or document ->> 'schemaVersion' is distinct from '2'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Canvas V1 rows exist; explicit V1 to V2 data migration is required';
  end if;
end;
$$;

create or replace function private.canvas_utf16_length(target text)
returns integer
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select char_length(target)
    + (
      select count(*)::integer
      from generate_series(1, char_length(target)) as positions(position)
      where ascii(substr(target, position, 1)) > 65535
    );
$$;

create or replace function private.assert_canvas_identifier(target jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  value text;
begin
  if jsonb_typeof(target) is distinct from 'string' then
    raise exception using errcode = '22023', message = 'invalid Canvas identifier';
  end if;
  value := target #>> '{}';
  if btrim(value) = ''
     or private.canvas_utf16_length(value) > 256
     or value ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'invalid Canvas identifier';
  end if;
end;
$$;

create or replace function private.assert_canvas_optional_title(target jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
begin
  if jsonb_typeof(target) is distinct from 'string'
     or private.canvas_utf16_length(target #>> '{}') > 200 then
    raise exception using errcode = '22023', message = 'invalid Canvas lastKnownTitle';
  end if;
end;
$$;

create or replace function public.assert_canvas_title(target_title text)
returns void
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
begin
  if target_title is null
     or btrim(target_title) = ''
     or private.canvas_utf16_length(target_title) > 200 then
    raise exception using errcode = '22023', message = 'invalid Canvas title';
  end if;
end;
$$;

create or replace function public.validate_canvas_document_v2(
  target_schema_version smallint,
  target_document jsonb
)
returns void
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
declare
  node_item jsonb;
  edge_item jsonb;
  node_kind text;
begin
  if target_schema_version is distinct from 2
     or target_document is null
     or not private.canvas_object_has_exact_keys(
       target_document,
       array['schemaVersion', 'nodes', 'edges']
     )
     or jsonb_typeof(target_document -> 'schemaVersion') is distinct from 'number'
     or (target_document ->> 'schemaVersion')::numeric is distinct from 2
     or jsonb_typeof(target_document -> 'nodes') is distinct from 'array'
     or jsonb_typeof(target_document -> 'edges') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'CanvasDocumentV2 validation failed';
  end if;

  if jsonb_array_length(target_document -> 'nodes') > 5000 then
    raise exception using errcode = '22023', message = 'Canvas node limit exceeded';
  end if;
  if jsonb_array_length(target_document -> 'edges') > 10000 then
    raise exception using errcode = '22023', message = 'Canvas edge limit exceeded';
  end if;

  for node_item in select value from jsonb_array_elements(target_document -> 'nodes') loop
    if jsonb_typeof(node_item) <> 'object' then
      raise exception using errcode = '22023', message = 'Canvas node must be an object';
    end if;

    node_kind := node_item ->> 'kind';
    if node_kind = 'task' then
      if not private.canvas_object_has_exact_keys(
        node_item,
        array['id', 'kind', 'position', 'size', 'zIndex', 'taskId'],
        array['lastKnownTitle']
      ) then
        raise exception using errcode = '22023', message = 'invalid Canvas task node';
      end if;
      perform private.assert_canvas_identifier(node_item -> 'taskId');
      if node_item ? 'lastKnownTitle' then
        perform private.assert_canvas_optional_title(node_item -> 'lastKnownTitle');
      end if;
    elsif node_kind = 'article' then
      if not private.canvas_object_has_exact_keys(
        node_item,
        array['id', 'kind', 'position', 'size', 'zIndex', 'articleId'],
        array['lastKnownTitle']
      ) then
        raise exception using errcode = '22023', message = 'invalid Canvas article node';
      end if;
      perform private.assert_canvas_identifier(node_item -> 'articleId');
      if node_item ? 'lastKnownTitle' then
        perform private.assert_canvas_optional_title(node_item -> 'lastKnownTitle');
      end if;
    elsif node_kind = 'text' then
      if not private.canvas_object_has_exact_keys(
        node_item,
        array['id', 'kind', 'position', 'size', 'zIndex', 'markdown']
      )
         or jsonb_typeof(node_item -> 'markdown') is distinct from 'string'
         or private.canvas_utf16_length(node_item ->> 'markdown') > 250000 then
        raise exception using errcode = '22023', message = 'invalid Canvas text node';
      end if;
    elsif node_kind = 'image' then
      if not private.canvas_object_has_exact_keys(
        node_item,
        array['id', 'kind', 'position', 'size', 'zIndex', 'assetId', 'aspectRatioLocked']
      )
         or jsonb_typeof(node_item -> 'aspectRatioLocked') is distinct from 'boolean' then
        raise exception using errcode = '22023', message = 'invalid Canvas image node';
      end if;
      perform private.assert_canvas_identifier(node_item -> 'assetId');
    else
      raise exception using errcode = '22023', message = 'unsupported Canvas node kind';
    end if;

    perform private.assert_canvas_identifier(node_item -> 'id');
    perform private.assert_canvas_point(node_item -> 'position');
    perform private.assert_canvas_size(node_item -> 'size');
    if jsonb_typeof(node_item -> 'zIndex') is distinct from 'number'
       or (node_item ->> 'zIndex') !~ '^-?[0-9]+$'
       or (node_item ->> 'zIndex')::numeric < -1000000
       or (node_item ->> 'zIndex')::numeric > 1000000 then
      raise exception using errcode = '22023', message = 'invalid Canvas zIndex';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(target_document -> 'nodes') as item
    group by item ->> 'id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'duplicate Canvas node ID';
  end if;

  for edge_item in select value from jsonb_array_elements(target_document -> 'edges') loop
    if not private.canvas_object_has_exact_keys(
      edge_item,
      array[
        'id',
        'sourceNodeId',
        'sourceHandle',
        'targetNodeId',
        'targetHandle',
        'routing',
        'arrows'
      ]
    ) then
      raise exception using errcode = '22023', message = 'invalid Canvas V2 edge';
    end if;

    perform private.assert_canvas_identifier(edge_item -> 'id');
    perform private.assert_canvas_identifier(edge_item -> 'sourceNodeId');
    perform private.assert_canvas_identifier(edge_item -> 'targetNodeId');

    if jsonb_typeof(edge_item -> 'sourceHandle') is distinct from 'string'
       or edge_item ->> 'sourceHandle' not in ('top', 'right', 'bottom', 'left') then
      raise exception using errcode = '22023', message = 'invalid Canvas source handle';
    end if;
    if jsonb_typeof(edge_item -> 'targetHandle') is distinct from 'string'
       or edge_item ->> 'targetHandle' not in ('top', 'right', 'bottom', 'left') then
      raise exception using errcode = '22023', message = 'invalid Canvas target handle';
    end if;
    if jsonb_typeof(edge_item -> 'routing') is distinct from 'string'
       or edge_item ->> 'routing' not in ('orthogonal', 'curved', 'straight') then
      raise exception using errcode = '22023', message = 'invalid Canvas routing';
    end if;
    if jsonb_typeof(edge_item -> 'arrows') is distinct from 'string'
       or edge_item ->> 'arrows' not in ('none', 'start', 'end', 'both') then
      raise exception using errcode = '22023', message = 'invalid Canvas arrows';
    end if;

    if edge_item ->> 'sourceNodeId' = edge_item ->> 'targetNodeId' then
      raise exception using errcode = '22023', message = 'Canvas self-edge is not allowed';
    end if;
    if not exists (
      select 1
      from jsonb_array_elements(target_document -> 'nodes') as item
      where item ->> 'id' = edge_item ->> 'sourceNodeId'
    ) or not exists (
      select 1
      from jsonb_array_elements(target_document -> 'nodes') as item
      where item ->> 'id' = edge_item ->> 'targetNodeId'
    ) then
      raise exception using errcode = '22023', message = 'Canvas edge references a missing node';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(target_document -> 'edges') as item
    group by item ->> 'id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'duplicate Canvas edge ID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(target_document -> 'edges') as item
    group by item ->> 'sourceNodeId', item ->> 'targetNodeId'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'duplicate Canvas edge endpoints';
  end if;
end;
$$;

do $$
declare
  constraint_item record;
begin
  for constraint_item in
    select conname
    from pg_constraint
    where conrelid = 'public.canvases'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%schema_version%'
        or pg_get_constraintdef(oid) ilike '%schemaversion%'
        or (
          pg_get_constraintdef(oid) ilike '%title%'
          and pg_get_constraintdef(oid) ilike '%char_length%'
        )
      )
  loop
    execute format(
      'alter table public.canvases drop constraint %I',
      constraint_item.conname
    );
  end loop;
end;
$$;

alter table public.canvases
  alter column schema_version set default 2,
  alter column document set default '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb;

alter table public.canvases
  add constraint canvases_schema_version_v2_check check (schema_version = 2),
  add constraint canvases_document_v2_check check (
    jsonb_typeof(document) = 'object'
    and document -> 'schemaVersion' = '2'::jsonb
  ),
  add constraint canvases_title_utf16_check check (
    btrim(title) <> ''
    and private.canvas_utf16_length(title) <= 200
  );

create or replace function public.validate_canvas_row_document()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  perform public.validate_canvas_document_v2(new.schema_version, new.document);
  return new;
end;
$$;

create or replace function public.create_canvas(
  target_workspace_id uuid,
  target_title text
)
returns table (id uuid, revision bigint)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'workspace access denied';
  end if;
  perform public.assert_canvas_title(target_title);
  return query
  insert into public.canvases (workspace_id, title, schema_version, document, revision, created_by)
  values (
    target_workspace_id,
    target_title,
    2,
    '{"schemaVersion":2,"nodes":[],"edges":[]}'::jsonb,
    1,
    (select auth.uid())
  )
  returning canvases.id, canvases.revision;
end;
$$;

create or replace function public.save_canvas_document(
  target_canvas_id uuid,
  target_expected_revision bigint,
  target_title text,
  target_document jsonb
)
returns table (status text, revision bigint)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_workspace_id uuid;
  current_revision bigint;
  current_deleted_at timestamptz;
begin
  if target_expected_revision is null or target_expected_revision <= 0 then
    raise exception using errcode = '22023', message = 'expected Canvas revision must be positive';
  end if;

  select workspace_id, canvases.revision, deleted_at
    into current_workspace_id, current_revision, current_deleted_at
    from public.canvases
   where canvases.id = target_canvas_id;
  if current_workspace_id is null
     or current_deleted_at is not null
     or not public.has_workspace_role(current_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas access denied';
  end if;

  perform public.assert_canvas_title(target_title);
  perform public.validate_canvas_document_v2(2::smallint, target_document);

  return query
  update public.canvases
     set title = target_title,
         schema_version = 2,
         document = target_document,
         revision = canvases.revision + 1
   where canvases.id = target_canvas_id
     and canvases.deleted_at is null
     and canvases.revision = target_expected_revision
  returning 'saved'::text, canvases.revision;

  if found then
    return;
  end if;

  select canvases.revision
    into current_revision
    from public.canvases
   where canvases.id = target_canvas_id;
  if current_revision is null then
    raise exception using errcode = '42501', message = 'Canvas access denied';
  end if;
  return query select 'conflict'::text, current_revision;
end;
$$;

revoke all on function private.canvas_utf16_length(text) from public, anon, authenticated;
revoke all on function public.validate_canvas_document_v2(smallint, jsonb) from public, anon, authenticated;
grant execute on function public.create_canvas(uuid, text) to authenticated;
grant execute on function public.save_canvas_document(uuid, bigint, text, jsonb) to authenticated;
grant execute on function public.delete_canvas(uuid) to authenticated;
