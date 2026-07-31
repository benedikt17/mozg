create function private.canvas_object_has_exact_keys(
  target jsonb,
  required_keys text[],
  optional_keys text[] default '{}'
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
    jsonb_typeof(target) = 'object'
      and target ?& required_keys
      and not exists (
        select 1
        from jsonb_object_keys(target) as key_name
        where not (key_name = any(required_keys || optional_keys))
      ),
    false
  );
$$;

create function private.assert_canvas_identifier(target jsonb)
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
  if btrim(value) = '' or char_length(value) > 256 or value ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'invalid Canvas identifier';
  end if;
end;
$$;

create function private.assert_canvas_number(
  target jsonb,
  minimum numeric,
  maximum numeric
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  value numeric;
begin
  if jsonb_typeof(target) is distinct from 'number'
     or (target #>> '{}') !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$' then
    raise exception using errcode = '22023', message = 'invalid Canvas number';
  end if;
  value := (target #>> '{}')::numeric;
  if value < minimum or value > maximum then
    raise exception using errcode = '22023', message = 'Canvas number is outside the allowed range';
  end if;
end;
$$;

create function private.assert_canvas_point(target jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if not private.canvas_object_has_exact_keys(target, array['x', 'y']) then
    raise exception using errcode = '22023', message = 'invalid Canvas position';
  end if;
  perform private.assert_canvas_number(target -> 'x', -1000000000, 1000000000);
  perform private.assert_canvas_number(target -> 'y', -1000000000, 1000000000);
end;
$$;

create function private.assert_canvas_size(target jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if not private.canvas_object_has_exact_keys(target, array['width', 'height']) then
    raise exception using errcode = '22023', message = 'invalid Canvas size';
  end if;
  perform private.assert_canvas_number(target -> 'width', 1, 100000);
  perform private.assert_canvas_number(target -> 'height', 1, 100000);
end;
$$;

create function private.assert_canvas_optional_title(target jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if jsonb_typeof(target) is distinct from 'string' or char_length(target #>> '{}') > 200 then
    raise exception using errcode = '22023', message = 'invalid Canvas lastKnownTitle';
  end if;
end;
$$;

create function public.assert_canvas_title(target_title text)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if target_title is null
     or btrim(target_title) = ''
     or char_length(target_title) > 200 then
    raise exception using errcode = '22023', message = 'invalid Canvas title';
  end if;
end;
$$;

create function public.validate_canvas_document_v1(
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
  if target_schema_version is distinct from 1
     or target_document is null
     or not private.canvas_object_has_exact_keys(
       target_document,
       array['schemaVersion', 'nodes', 'edges']
     )
     or jsonb_typeof(target_document -> 'schemaVersion') is distinct from 'number'
     or (target_document ->> 'schemaVersion') <> '1'
     or jsonb_typeof(target_document -> 'nodes') is distinct from 'array'
     or jsonb_typeof(target_document -> 'edges') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'CanvasDocumentV1 validation failed';
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
      ) or jsonb_typeof(node_item -> 'markdown') is distinct from 'string'
        or char_length(node_item ->> 'markdown') > 250000 then
        raise exception using errcode = '22023', message = 'invalid Canvas text node';
      end if;
    elsif node_kind = 'image' then
      if not private.canvas_object_has_exact_keys(
        node_item,
        array['id', 'kind', 'position', 'size', 'zIndex', 'assetId', 'aspectRatioLocked']
      ) or jsonb_typeof(node_item -> 'aspectRatioLocked') is distinct from 'boolean' then
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
      array['id', 'sourceNodeId', 'targetNodeId']
    ) then
      raise exception using errcode = '22023', message = 'invalid Canvas edge';
    end if;
    perform private.assert_canvas_identifier(edge_item -> 'id');
    perform private.assert_canvas_identifier(edge_item -> 'sourceNodeId');
    perform private.assert_canvas_identifier(edge_item -> 'targetNodeId');
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

create table public.canvases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  title text not null,
  schema_version smallint not null default 1 check (schema_version = 1),
  document jsonb not null default '{"schemaVersion":1,"nodes":[],"edges":[]}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, id),
  check (char_length(btrim(title)) > 0 and char_length(title) <= 200),
  check ((
    jsonb_typeof(document) = 'object'
    and document ->> 'schemaVersion' = '1'
  ) is true)
);

create trigger canvases_set_updated_at
before update on public.canvases
for each row execute function public.set_updated_at();

create trigger canvases_guard_workspace_id
before update on public.canvases
for each row execute function public.guard_workspace_id();

create function public.validate_canvas_row_document()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  perform public.validate_canvas_document_v1(new.schema_version, new.document);
  return new;
end;
$$;

create trigger canvases_validate_document
before insert or update on public.canvases
for each row execute function public.validate_canvas_row_document();

create table public.canvas_view_states (
  canvas_id uuid not null references public.canvases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewport_x double precision not null default 0,
  viewport_y double precision not null default 0,
  zoom double precision not null default 1,
  updated_at timestamptz not null default now(),
  primary key (canvas_id, user_id),
  check (
    viewport_x::text not in ('NaN', 'Infinity', '-Infinity')
    and viewport_y::text not in ('NaN', 'Infinity', '-Infinity')
    and viewport_x between -1000000000 and 1000000000
    and viewport_y between -1000000000 and 1000000000
  ),
  check (
    zoom::text not in ('NaN', 'Infinity', '-Infinity')
    and zoom between 0.1 and 4
  )
);

create trigger canvas_view_states_set_updated_at
before update on public.canvas_view_states
for each row execute function public.set_updated_at();

create table public.canvas_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  storage_key text not null,
  preview_storage_key text,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  width integer not null check (width > 0 and width <= 10000),
  height integer not null check (height > 0 and height <= 10000),
  checksum text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  deleted_at timestamptz,
  unique (workspace_id, id),
  check (storage_key = workspace_id::text || '/' || id::text || '/original'),
  check (
    preview_storage_key is null
    or preview_storage_key = workspace_id::text || '/' || id::text || '/preview.webp'
  ),
  check ((width::bigint * height::bigint) <= 40000000),
  check (checksum is null or (btrim(checksum) <> '' and char_length(checksum) <= 256))
);

alter table public.canvases enable row level security;
alter table public.canvas_view_states enable row level security;
alter table public.canvas_assets enable row level security;

create policy canvases_select_member
on public.canvases
for select
to authenticated
using (
  deleted_at is null
  and public.is_workspace_member(workspace_id)
);

create policy canvas_view_states_select_owner
on public.canvas_view_states
for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.canvases
    where canvases.id = canvas_view_states.canvas_id
      and canvases.deleted_at is null
      and public.is_workspace_member(canvases.workspace_id)
  )
);

create policy canvas_view_states_insert_owner
on public.canvas_view_states
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.canvases
    where canvases.id = canvas_view_states.canvas_id
      and canvases.deleted_at is null
      and public.is_workspace_member(canvases.workspace_id)
  )
);

create policy canvas_view_states_update_owner
on public.canvas_view_states
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.canvases
    where canvases.id = canvas_view_states.canvas_id
      and canvases.deleted_at is null
      and public.is_workspace_member(canvases.workspace_id)
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.canvases
    where canvases.id = canvas_view_states.canvas_id
      and canvases.deleted_at is null
      and public.is_workspace_member(canvases.workspace_id)
  )
);

create policy canvas_assets_select_member
on public.canvas_assets
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy canvas_assets_insert_member
on public.canvas_assets
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_workspace_member(workspace_id)
);

revoke all on table public.canvases from public, anon, authenticated;
revoke all on table public.canvas_view_states from public, anon, authenticated;
revoke all on table public.canvas_assets from public, anon, authenticated;
grant select on table public.canvases to authenticated;
grant select, insert, update on table public.canvas_view_states to authenticated;
grant select, insert on table public.canvas_assets to authenticated;

create function public.create_canvas(
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
    1,
    '{"schemaVersion":1,"nodes":[],"edges":[]}'::jsonb,
    1,
    (select auth.uid())
  )
  returning canvases.id, canvases.revision;
end;
$$;

create function public.save_canvas_document(
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
  perform public.validate_canvas_document_v1(1::smallint, target_document);

  return query
  update public.canvases
     set title = target_title,
         schema_version = 1,
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

create function public.delete_canvas(target_canvas_id uuid)
returns table (deleted boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_workspace_id uuid;
  current_deleted_at timestamptz;
begin
  select workspace_id, canvases.deleted_at
    into current_workspace_id, current_deleted_at
    from public.canvases
   where canvases.id = target_canvas_id;
  if current_workspace_id is null
     or not public.has_workspace_role(current_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas access denied';
  end if;

  if current_deleted_at is not null then
    return query select false;
    return;
  end if;

  return query
  update public.canvases
     set deleted_at = now()
   where canvases.id = target_canvas_id
     and canvases.deleted_at is null
  returning true;
end;
$$;

revoke all on function private.canvas_object_has_exact_keys(jsonb, text[], text[]) from public, anon, authenticated;
revoke all on function private.assert_canvas_identifier(jsonb) from public, anon, authenticated;
revoke all on function private.assert_canvas_number(jsonb, numeric, numeric) from public, anon, authenticated;
revoke all on function private.assert_canvas_point(jsonb) from public, anon, authenticated;
revoke all on function private.assert_canvas_size(jsonb) from public, anon, authenticated;
revoke all on function private.assert_canvas_optional_title(jsonb) from public, anon, authenticated;
revoke all on function public.assert_canvas_title(text) from public, anon, authenticated;
revoke all on function public.validate_canvas_document_v1(smallint, jsonb) from public, anon, authenticated;
revoke all on function public.validate_canvas_row_document() from public, anon, authenticated;
revoke all on function public.create_canvas(uuid, text) from public, anon, authenticated;
revoke all on function public.save_canvas_document(uuid, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.delete_canvas(uuid) from public, anon, authenticated;

grant execute on function public.create_canvas(uuid, text) to authenticated;
grant execute on function public.save_canvas_document(uuid, bigint, text, jsonb) to authenticated;
grant execute on function public.delete_canvas(uuid) to authenticated;
