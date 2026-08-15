-- Files B3: Canvas image nodes may reference same-Project ready Project Files by fileId.
-- Legacy assetId nodes remain valid and keep their existing canvas_assets checks.

alter function public.validate_canvas_document_v2(smallint, jsonb)
  set schema private;
alter function private.validate_canvas_document_v2(smallint, jsonb)
  rename to validate_canvas_document_v2_legacy_b3;

create function public.validate_canvas_document_v2(
  target_schema_version smallint,
  target_document jsonb
)
returns void
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
declare
  normalized_document jsonb := target_document;
begin
  if jsonb_typeof(target_document) = 'object'
     and jsonb_typeof(target_document -> 'nodes') = 'array' then
    if exists (
      select 1
      from jsonb_array_elements(target_document -> 'nodes') as item
      where item ->> 'kind' = 'image'
        and (item ? 'assetId') = (item ? 'fileId')
    ) then
      raise exception using
        errcode = '22023',
        message = 'Canvas image must reference exactly one assetId or fileId';
    end if;

    select jsonb_set(
      target_document,
      '{nodes}',
      coalesce(
        jsonb_agg(
          case
            when item.value ->> 'kind' = 'image' and item.value ? 'fileId'
              then (item.value - 'fileId') || jsonb_build_object('assetId', item.value -> 'fileId')
            else item.value
          end
          order by item.ordinality
        ),
        '[]'::jsonb
      )
    )
    into normalized_document
    from jsonb_array_elements(target_document -> 'nodes')
      with ordinality as item(value, ordinality);
  end if;

  perform private.validate_canvas_document_v2_legacy_b3(
    target_schema_version,
    normalized_document
  );
end;
$$;

-- The legacy checker remains authoritative for canvas_assets, but must ignore
-- B3 Project File nodes instead of interpreting fileId as a missing assetId.
create or replace function private.assert_canvas_asset_references(
  target_canvas_id uuid,
  target_workspace_id uuid,
  target_document jsonb
)
returns void
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if exists (
    select 1
    from jsonb_array_elements(target_document -> 'nodes') as node_item
    where node_item ->> 'kind' = 'image'
      and node_item ? 'assetId'
      and not exists (
        select 1
        from public.canvas_assets as asset
        where asset.id::text = node_item ->> 'assetId'
          and asset.workspace_id = target_workspace_id
          and asset.canvas_id = target_canvas_id
          and asset.ready_at is not null
          and asset.deleted_at is null
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'Canvas image references an unavailable asset';
  end if;
end;
$$;

create function private.assert_canvas_project_file_references(
  target_workspace_id uuid,
  target_project_id text,
  target_document jsonb
)
returns void
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  node_item jsonb;
  target_file_id text;
begin
  for node_item in
    select value
    from jsonb_array_elements(target_document -> 'nodes')
    where value ->> 'kind' = 'image'
      and value ? 'fileId'
  loop
    target_file_id := node_item ->> 'fileId';
    if target_project_id is null
       or not exists (
         select 1
         from public.project_files as file_row
         where file_row.workspace_id = target_workspace_id
           and file_row.project_id = target_project_id
           and file_row.id::text = target_file_id
           and file_row.ready_at is not null
           and file_row.deleted_at is null
           and file_row.mime_type like 'image/%'
           and file_row.width is not null
           and file_row.height is not null
       ) then
      raise exception using
        errcode = '22023',
        message = 'Canvas Project File reference is unavailable';
    end if;
  end loop;
end;
$$;

create or replace function public.validate_canvas_row_document()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  perform public.validate_canvas_document_v2(new.schema_version, new.document);
  perform private.assert_canvas_asset_references(new.id, new.workspace_id, new.document);
  perform private.assert_canvas_project_file_references(
    new.workspace_id,
    new.project_id,
    new.document
  );
  return new;
end;
$$;

revoke all on function private.validate_canvas_document_v2_legacy_b3(smallint, jsonb)
  from public, anon, authenticated;
revoke all on function public.validate_canvas_document_v2(smallint, jsonb)
  from public, anon, authenticated;
revoke all on function private.assert_canvas_asset_references(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.assert_canvas_project_file_references(uuid, text, jsonb)
  from public, anon, authenticated;

comment on function public.validate_canvas_document_v2(smallint, jsonb) is
  'Validates CanvasDocumentV2 while accepting exactly one legacy assetId or shared Project File fileId per image node.';
comment on function private.assert_canvas_project_file_references(uuid, text, jsonb) is
  'Files B3 invariant: Canvas image fileId must reference a ready, non-deleted image Project File in the same workspace and Project.';
