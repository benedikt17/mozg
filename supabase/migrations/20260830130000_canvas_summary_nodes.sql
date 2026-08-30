-- Canvas summary nodes are live, Canvas-local Markdown views. Their sources
-- remain canonical text/shape nodes; only the incoming edge order is stored.

alter function public.validate_canvas_document_v2(smallint, jsonb)
  set schema private;
alter function private.validate_canvas_document_v2(smallint, jsonb)
  rename to validate_canvas_document_v2_legacy_summary_b6;

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
  normalized_nodes jsonb;
  normalized_edges jsonb;
  node_item jsonb;
begin
  if jsonb_typeof(target_document) = 'object'
     and jsonb_typeof(target_document -> 'nodes') = 'array'
     and jsonb_typeof(target_document -> 'edges') = 'array' then
    for node_item in
      select value
      from jsonb_array_elements(target_document -> 'nodes')
      where value ->> 'kind' = 'summary'
    loop
      if not private.canvas_object_has_exact_keys(
        node_item,
        array['id', 'kind', 'position', 'size', 'zIndex', 'title']
      )
         or jsonb_typeof(node_item -> 'title') is distinct from 'string'
         or btrim(node_item ->> 'title') = ''
         or private.canvas_utf16_length(node_item ->> 'title') > 200 then
        raise exception using errcode = '22023', message = 'invalid Canvas summary node';
      end if;
    end loop;

    if exists (
      select 1
      from jsonb_array_elements(target_document -> 'edges') as edge_item
      where edge_item ? 'summaryOrder'
        and (
          jsonb_typeof(edge_item -> 'summaryOrder') is distinct from 'number'
          or edge_item ->> 'summaryOrder' !~ '^[1-9][0-9]*$'
          or (edge_item ->> 'summaryOrder')::numeric > 9007199254740991
        )
    ) then
      raise exception using errcode = '22023', message = 'invalid Canvas summary order';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(target_document -> 'edges') as edge_item
      join jsonb_array_elements(target_document -> 'nodes') as target_node
        on target_node ->> 'id' = edge_item ->> 'targetNodeId'
      left join jsonb_array_elements(target_document -> 'nodes') as source_node
        on source_node ->> 'id' = edge_item ->> 'sourceNodeId'
      where target_node ->> 'kind' = 'summary'
        and (
          not (edge_item ? 'summaryOrder')
          or source_node ->> 'kind' not in ('text', 'shape')
        )
    ) then
      raise exception using errcode = '22023', message = 'invalid Canvas summary connection';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(target_document -> 'edges') as edge_item
      join jsonb_array_elements(target_document -> 'nodes') as source_node
        on source_node ->> 'id' = edge_item ->> 'sourceNodeId'
      where source_node ->> 'kind' = 'summary'
    ) then
      raise exception using errcode = '22023', message = 'Canvas summary nodes are input-only';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(target_document -> 'edges') as edge_item
      left join jsonb_array_elements(target_document -> 'nodes') as target_node
        on target_node ->> 'id' = edge_item ->> 'targetNodeId'
      where edge_item ? 'summaryOrder'
        and target_node ->> 'kind' is distinct from 'summary'
    ) then
      raise exception using errcode = '22023', message = 'unexpected Canvas summary order';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(target_document -> 'edges') as edge_item
      join jsonb_array_elements(target_document -> 'nodes') as target_node
        on target_node ->> 'id' = edge_item ->> 'targetNodeId'
      where target_node ->> 'kind' = 'summary'
      group by edge_item ->> 'targetNodeId', edge_item ->> 'summaryOrder'
      having count(*) > 1
    ) then
      raise exception using errcode = '22023', message = 'duplicate Canvas summary order';
    end if;

    select coalesce(
      jsonb_agg(
        case
          when item.value ->> 'kind' = 'summary' then jsonb_build_object(
            'id', item.value -> 'id',
            'kind', 'text',
            'position', item.value -> 'position',
            'size', item.value -> 'size',
            'zIndex', item.value -> 'zIndex',
            'markdown', ''
          )
          else item.value
        end
        order by item.ordinality
      ),
      '[]'::jsonb
    ) into normalized_nodes
    from jsonb_array_elements(target_document -> 'nodes')
      with ordinality as item(value, ordinality);

    select coalesce(
      jsonb_agg(item.value - 'summaryOrder' order by item.ordinality),
      '[]'::jsonb
    ) into normalized_edges
    from jsonb_array_elements(target_document -> 'edges')
      with ordinality as item(value, ordinality);

    normalized_document := jsonb_set(
      jsonb_set(target_document, '{nodes}', normalized_nodes),
      '{edges}',
      normalized_edges
    );
  end if;

  perform private.validate_canvas_document_v2_legacy_summary_b6(
    target_schema_version,
    normalized_document
  );
end;
$$;

revoke all on function private.validate_canvas_document_v2_legacy_summary_b6(smallint, jsonb)
  from public, anon, authenticated;
revoke all on function public.validate_canvas_document_v2(smallint, jsonb)
  from public, anon, authenticated;

comment on function public.validate_canvas_document_v2(smallint, jsonb) is
  'Validates CanvasDocumentV2 including live summary nodes with ordered text/shape inputs.';
