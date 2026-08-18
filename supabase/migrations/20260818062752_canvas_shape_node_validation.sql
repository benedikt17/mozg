-- Canvas shape nodes extend the existing CanvasDocumentV2 contract without
-- changing the document schema version. The cloud boundary remains strict:
-- rectangle/circle nodes are validated canonically, then normalized to the
-- already-authoritative styled text shape for shared base-node/edge checks.

create or replace function private.assert_canvas_shape_style(target jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
declare
  text_style jsonb;
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
         'fillColor'
       ],
       array['textAlign']
     ) then
    raise exception using errcode = '22023', message = 'invalid Canvas shape style';
  end if;

  text_style := (target - 'fillColor')
    || jsonb_build_object('backgroundColor', target -> 'fillColor');

  perform private.assert_canvas_text_style(text_style);
end;
$$;

revoke all on function private.assert_canvas_shape_style(jsonb)
  from public, anon, authenticated;

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
      select 1
      from jsonb_array_elements(target_document -> 'nodes') as item
      where item ->> 'kind' = 'image'
        and (item ? 'assetId') = (item ? 'fileId')
    ) then
      raise exception using
        errcode = '22023',
        message = 'Canvas image must reference exactly one assetId or fileId';
    end if;

    for node_item in
      select value
      from jsonb_array_elements(target_document -> 'nodes')
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

    select jsonb_set(
      target_document,
      '{nodes}',
      coalesce(
        jsonb_agg(
          case
            when item.value ->> 'kind' = 'image' and item.value ? 'fileId'
              then (item.value - 'fileId')
                || jsonb_build_object('assetId', item.value -> 'fileId')
            when item.value ->> 'kind' = 'shape'
              then (item.value - 'shape')
                || jsonb_build_object('kind', 'text')
                || jsonb_build_object(
                  'style',
                  ((item.value -> 'style') - 'fillColor')
                    || jsonb_build_object(
                      'backgroundColor',
                      item.value -> 'style' -> 'fillColor'
                    )
                )
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

revoke all on function public.validate_canvas_document_v2(smallint, jsonb)
  from public, anon, authenticated;

comment on function public.validate_canvas_document_v2(smallint, jsonb) is
  'Validates CanvasDocumentV2 including canonical rectangle/circle shape nodes and legacy/shared image references.';

comment on function private.assert_canvas_shape_style(jsonb) is
  'Validates canonical Canvas shape typography, text color and fillColor through the shared text-style rules.';
