-- Canvas V2 remains a strict JSON contract. These two optional presentation
-- fields are persisted in the existing document JSON; no table, RLS policy or
-- binary file lifecycle changes are required.

alter function public.validate_canvas_document_v2(smallint, jsonb)
  set schema private;
alter function private.validate_canvas_document_v2(smallint, jsonb)
  rename to validate_canvas_document_v2_legacy_pins_bends_b7;

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
  node_item jsonb;
  edge_item jsonb;
  pin_item jsonb;
begin
  if jsonb_typeof(target_document) = 'object'
     and jsonb_typeof(target_document -> 'nodes') = 'array'
     and jsonb_typeof(target_document -> 'edges') = 'array' then
    if exists (
      select 1
      from jsonb_array_elements(target_document -> 'nodes') as item
      where item ? 'pins' and item ->> 'kind' is distinct from 'image'
    ) then
      raise exception using errcode = '22023', message = 'Canvas pins require an image node';
    end if;

    for node_item in
      select value
      from jsonb_array_elements(target_document -> 'nodes')
      where value ->> 'kind' = 'image' and value ? 'pins'
    loop
      if jsonb_typeof(node_item -> 'pins') is distinct from 'array' then
        raise exception using errcode = '22023', message = 'invalid Canvas image pins';
      end if;
      if jsonb_array_length(node_item -> 'pins') > 200 then
        raise exception using errcode = '22023', message = 'invalid Canvas image pins';
      end if;

      if exists (
        select 1
        from jsonb_array_elements(node_item -> 'pins') as pin(value)
        group by pin.value ->> 'id'
        having count(*) > 1
      ) then
        raise exception using errcode = '22023', message = 'duplicate Canvas image pin ID';
      end if;

      for pin_item in select value from jsonb_array_elements(node_item -> 'pins') loop
        if not private.canvas_object_has_exact_keys(pin_item, array['id', 'x', 'y'])
           or jsonb_typeof(pin_item -> 'x') is distinct from 'number'
           or jsonb_typeof(pin_item -> 'y') is distinct from 'number' then
          raise exception using errcode = '22023', message = 'invalid Canvas image pin';
        end if;
        if (pin_item ->> 'x')::numeric < 0
           or (pin_item ->> 'x')::numeric > 1
           or (pin_item ->> 'y')::numeric < 0
           or (pin_item ->> 'y')::numeric > 1 then
          raise exception using errcode = '22023', message = 'invalid Canvas image pin';
        end if;
        perform private.assert_canvas_identifier(pin_item -> 'id');
      end loop;
    end loop;

    for edge_item in
      select value
      from jsonb_array_elements(target_document -> 'edges')
      where value ? 'bend'
    loop
      perform private.assert_canvas_point(edge_item -> 'bend');
    end loop;

    select jsonb_set(
      target_document,
      '{nodes}',
      coalesce(
        jsonb_agg(item.value - 'pins' order by item.ordinality),
        '[]'::jsonb
      )
    )
    into normalized_document
    from jsonb_array_elements(target_document -> 'nodes')
      with ordinality as item(value, ordinality);

    select jsonb_set(
      normalized_document,
      '{edges}',
      coalesce(
        jsonb_agg(item.value - 'bend' order by item.ordinality),
        '[]'::jsonb
      )
    )
    into normalized_document
    from jsonb_array_elements(normalized_document -> 'edges')
      with ordinality as item(value, ordinality);
  end if;

  perform private.validate_canvas_document_v2_legacy_pins_bends_b7(
    target_schema_version,
    normalized_document
  );
end;
$$;

revoke all on function private.validate_canvas_document_v2_legacy_pins_bends_b7(smallint, jsonb)
  from public, anon, authenticated;
revoke all on function public.validate_canvas_document_v2(smallint, jsonb)
  from public, anon, authenticated;

comment on function public.validate_canvas_document_v2(smallint, jsonb) is
  'Validates CanvasDocumentV2 including optional manual edge bends and image-local pins.';
