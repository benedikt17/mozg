-- Canvas PDF nodes: first-class Project File references for application/pdf.

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
  normalized_document jsonb := target_document;
  node_item jsonb;
begin
  if jsonb_typeof(target_document) = 'object'
     and jsonb_typeof(target_document -> 'nodes') = 'array' then
    if exists (
      select 1 from jsonb_array_elements(target_document -> 'nodes') as item
      where item ->> 'kind' = 'image' and (item ? 'assetId') = (item ? 'fileId')
    ) then
      raise exception using errcode = '22023', message = 'Canvas image must reference exactly one assetId or fileId';
    end if;

    for node_item in
      select value from jsonb_array_elements(target_document -> 'nodes')
      where value ->> 'kind' = 'shape'
    loop
      if not private.canvas_object_has_exact_keys(
        node_item,
        array[
          'id',
          'kind',
          'position',
          'size',
          'zIndex',
          'shape',
          'markdown',
          'style'
        ]
      ) then
        raise exception using errcode = '22023', message = 'invalid Canvas shape node';
      end if;

      if jsonb_typeof(node_item -> 'shape') is distinct from 'string'
         or node_item ->> 'shape' not in ('rectangle', 'circle') then
        raise exception using errcode = '22023', message = 'invalid Canvas shape variant';
      end if;

      if jsonb_typeof(node_item -> 'markdown') is distinct from 'string'
         or private.canvas_utf16_length(node_item ->> 'markdown') > 250000 then
        raise exception using errcode = '22023', message = 'invalid Canvas shape markdown';
      end if;

      perform private.assert_canvas_shape_style(node_item -> 'style');
    end loop;

    for node_item in
      select value from jsonb_array_elements(target_document -> 'nodes')
      where value ->> 'kind' = 'pdf'
    loop
      if not private.canvas_object_has_exact_keys(
        node_item,
        array['id','kind','position','size','zIndex','fileId'],
        array['lastKnownName']
      ) then
        raise exception using errcode = '22023', message = 'invalid Canvas PDF node';
      end if;
      if jsonb_typeof(node_item -> 'fileId') is distinct from 'string'
         or private.canvas_utf16_length(node_item ->> 'fileId') = 0
         or private.canvas_utf16_length(node_item ->> 'fileId') > 256 then
        raise exception using errcode = '22023', message = 'invalid Canvas PDF fileId';
      end if;
      if node_item ? 'lastKnownName' and (
        jsonb_typeof(node_item -> 'lastKnownName') is distinct from 'string'
        or private.canvas_utf16_length(node_item ->> 'lastKnownName') > 255
      ) then
        raise exception using errcode = '22023', message = 'invalid Canvas PDF name';
      end if;
    end loop;

    select jsonb_set(
      target_document,
      '{nodes}',
      coalesce(jsonb_agg(
        case
          when item.value ->> 'kind' = 'image' and item.value ? 'fileId'
            then (item.value - 'fileId') || jsonb_build_object('assetId', item.value -> 'fileId')
          when item.value ->> 'kind' = 'shape'
            then (item.value - 'shape') || jsonb_build_object('kind', 'text') || jsonb_build_object(
              'style', ((item.value -> 'style') - 'fillColor') || jsonb_build_object('backgroundColor', item.value -> 'style' -> 'fillColor')
            )
          when item.value ->> 'kind' = 'pdf'
            then jsonb_build_object(
              'id', item.value -> 'id',
              'kind', 'text',
              'position', item.value -> 'position',
              'size', item.value -> 'size',
              'zIndex', item.value -> 'zIndex',
              'markdown', '',
              'style', jsonb_build_object(
                'fontFamily','system','fontSize',18,'bold',false,'italic',false,'underline',false,'strikethrough',false,
                'color','#000000','backgroundColor','transparent','textAlign','center'
              )
            )
          else item.value
        end order by item.ordinality
      ), '[]'::jsonb)
    ) into normalized_document
    from jsonb_array_elements(target_document -> 'nodes') with ordinality as item(value, ordinality);
  end if;

  perform private.validate_canvas_document_v2_legacy_b3(target_schema_version, normalized_document);
end;
$$;

create or replace function private.assert_canvas_project_file_references(
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
  target_kind text;
begin
  for node_item in
    select value from jsonb_array_elements(target_document -> 'nodes')
    where (value ->> 'kind' = 'image' and value ? 'fileId')
       or value ->> 'kind' = 'pdf'
  loop
    target_file_id := node_item ->> 'fileId';
    target_kind := node_item ->> 'kind';
    if target_project_id is null or not exists (
      select 1 from public.project_files as file_row
      where file_row.workspace_id = target_workspace_id
        and file_row.project_id = target_project_id
        and file_row.id::text = target_file_id
        and file_row.ready_at is not null
        and file_row.deleted_at is null
        and ((target_kind = 'image' and file_row.mime_type like 'image/%' and file_row.width is not null and file_row.height is not null)
          or (target_kind = 'pdf' and file_row.mime_type = 'application/pdf'))
    ) then
      raise exception using errcode = '22023', message = 'Canvas Project File reference is unavailable';
    end if;
  end loop;
end;
$$;

revoke all on function public.validate_canvas_document_v2(smallint, jsonb) from public, anon, authenticated;
revoke all on function private.assert_canvas_project_file_references(uuid, text, jsonb) from public, anon, authenticated;
