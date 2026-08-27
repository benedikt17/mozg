-- Persisted branch-collapse state belongs to a Canvas node, while the hidden
-- descendants remain a React Flow projection. The public boundary validates
-- the one extra property, then delegates all existing Canvas V2 rules after
-- stripping it from the legacy validator input.

alter function public.validate_canvas_document_v2(smallint, jsonb)
  set schema private;
alter function private.validate_canvas_document_v2(smallint, jsonb)
  rename to validate_canvas_document_v2_legacy_branch_b4;

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
      where item ? 'branchCollapsed'
        and jsonb_typeof(item -> 'branchCollapsed') is distinct from 'boolean'
    ) then
      raise exception using
        errcode = '22023',
        message = 'invalid Canvas branch collapsed state';
    end if;

    select jsonb_set(
      target_document,
      '{nodes}',
      coalesce(
        jsonb_agg(item.value - 'branchCollapsed' order by item.ordinality),
        '[]'::jsonb
      )
    )
    into normalized_document
    from jsonb_array_elements(target_document -> 'nodes')
      with ordinality as item(value, ordinality);
  end if;

  perform private.validate_canvas_document_v2_legacy_branch_b4(
    target_schema_version,
    normalized_document
  );
end;
$$;

revoke all on function private.validate_canvas_document_v2_legacy_branch_b4(smallint, jsonb)
  from public, anon, authenticated;
revoke all on function public.validate_canvas_document_v2(smallint, jsonb)
  from public, anon, authenticated;

comment on function public.validate_canvas_document_v2(smallint, jsonb) is
  'Validates CanvasDocumentV2 including the optional boolean branchCollapsed node state.';
