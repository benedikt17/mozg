create or replace function private.assert_canvas_text_style(target jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
begin
  if target is null
     or jsonb_typeof(target) is distinct from 'object'
     or not private.canvas_object_has_exact_keys(
       target,
       array[
         'fontFamily',
         'fontSize',
         'bold',
         'italic',
         'underline',
         'strikethrough',
         'color',
         'backgroundColor'
       ],
       array['textAlign']
     ) then
    raise exception using errcode = '22023', message = 'invalid Canvas text style';
  end if;

  if jsonb_typeof(target -> 'fontFamily') is distinct from 'string'
     or target ->> 'fontFamily' not in (
       'system',
       'arial',
       'georgia',
       'times-new-roman',
       'courier-new',
       'verdana'
     ) then
    raise exception using errcode = '22023', message = 'invalid Canvas text font family';
  end if;

  if jsonb_typeof(target -> 'fontSize') is distinct from 'number'
     or (target ->> 'fontSize')::numeric not in (10, 12, 14, 18, 24, 36, 48, 64, 80, 144, 288) then
    raise exception using errcode = '22023', message = 'invalid Canvas text font size';
  end if;

  if jsonb_typeof(target -> 'bold') is distinct from 'boolean'
     or jsonb_typeof(target -> 'italic') is distinct from 'boolean'
     or jsonb_typeof(target -> 'underline') is distinct from 'boolean'
     or jsonb_typeof(target -> 'strikethrough') is distinct from 'boolean' then
    raise exception using errcode = '22023', message = 'invalid Canvas text style flags';
  end if;

  if jsonb_typeof(target -> 'color') is distinct from 'string'
     or not (
       target ->> 'color' = 'transparent'
       or target ->> 'color' ~ '^#[0-9A-Fa-f]{6}$'
     ) then
    raise exception using errcode = '22023', message = 'invalid Canvas text color';
  end if;

  if jsonb_typeof(target -> 'backgroundColor') is distinct from 'string'
     or not (
       target ->> 'backgroundColor' = 'transparent'
       or target ->> 'backgroundColor' ~ '^#[0-9A-Fa-f]{6}$'
     ) then
    raise exception using errcode = '22023', message = 'invalid Canvas text background color';
  end if;

  if target ? 'textAlign'
     and (
       jsonb_typeof(target -> 'textAlign') is distinct from 'string'
       or target ->> 'textAlign' not in ('left', 'center', 'right')
     ) then
    raise exception using errcode = '22023', message = 'invalid Canvas text alignment';
  end if;
end;
$$;

revoke all on function private.assert_canvas_text_style(jsonb) from public;
revoke all on function private.assert_canvas_text_style(jsonb) from anon;
revoke all on function private.assert_canvas_text_style(jsonb) from authenticated;

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
        array['id', 'kind', 'position', 'size', 'zIndex', 'markdown'],
        array['style']
      )
         or jsonb_typeof(node_item -> 'markdown') is distinct from 'string'
         or private.canvas_utf16_length(node_item ->> 'markdown') > 250000 then
        raise exception using errcode = '22023', message = 'invalid Canvas text node';
      end if;
      if node_item ? 'style' then
        perform private.assert_canvas_text_style(node_item -> 'style');
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
