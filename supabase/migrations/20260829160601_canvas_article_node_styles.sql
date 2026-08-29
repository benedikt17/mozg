-- Article presentation belongs to the Canvas graph. The reader itself remains
-- user-local view state. Keep the new style optional so old documents remain
-- valid, then strip it before delegating to the existing strict validator.

create function private.assert_canvas_article_style(target jsonb)
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
       array['badgeColor', 'titleColor', 'backgroundColor', 'titleFontSize']
     ) then
    raise exception using errcode = '22023', message = 'invalid Canvas article style';
  end if;

  if jsonb_typeof(target -> 'titleFontSize') is distinct from 'number'
     or (target ->> 'titleFontSize')::numeric not in (10, 12, 14, 18, 24, 36, 48, 64, 80, 144, 288) then
    raise exception using errcode = '22023', message = 'invalid Canvas article title font size';
  end if;

  if jsonb_typeof(target -> 'badgeColor') is distinct from 'string'
     or target ->> 'badgeColor' !~ '^#[0-9A-Fa-f]{6}$'
     or jsonb_typeof(target -> 'titleColor') is distinct from 'string'
     or target ->> 'titleColor' !~ '^#[0-9A-Fa-f]{6}$'
     or jsonb_typeof(target -> 'backgroundColor') is distinct from 'string'
     or target ->> 'backgroundColor' !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception using errcode = '22023', message = 'invalid Canvas article color';
  end if;
end;
$$;

revoke all on function private.assert_canvas_article_style(jsonb)
  from public, anon, authenticated;

alter function public.validate_canvas_document_v2(smallint, jsonb)
  set schema private;
alter function private.validate_canvas_document_v2(smallint, jsonb)
  rename to validate_canvas_document_v2_legacy_article_style_b5;

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
begin
  if jsonb_typeof(target_document) = 'object'
     and jsonb_typeof(target_document -> 'nodes') = 'array' then
    for node_item in
      select value
      from jsonb_array_elements(target_document -> 'nodes')
      where value ->> 'kind' = 'article' and value ? 'style'
    loop
      perform private.assert_canvas_article_style(node_item -> 'style');
    end loop;

    select jsonb_set(
      target_document,
      '{nodes}',
      coalesce(
        jsonb_agg(
          case
            when item.value ->> 'kind' = 'article' then item.value - 'style'
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

  perform private.validate_canvas_document_v2_legacy_article_style_b5(
    target_schema_version,
    normalized_document
  );
end;
$$;

revoke all on function private.validate_canvas_document_v2_legacy_article_style_b5(smallint, jsonb)
  from public, anon, authenticated;
revoke all on function public.validate_canvas_document_v2(smallint, jsonb)
  from public, anon, authenticated;

comment on function public.validate_canvas_document_v2(smallint, jsonb) is
  'Validates CanvasDocumentV2 including optional persisted Knowledge article node presentation.';
