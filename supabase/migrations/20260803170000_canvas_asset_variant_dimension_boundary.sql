-- Preserve the one-pixel aspect-ratio tolerance without division rounding.
create or replace function private.validate_canvas_asset_variant_dimensions()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  original record;
begin
  select width, height
    into original
    from public.canvas_assets
   where workspace_id = new.workspace_id
     and canvas_id = new.canvas_id
     and id = new.asset_id;
  if not found
     or new.pixel_width > original.width
     or new.pixel_height > original.height
     or abs(
       new.pixel_width * original.height -
       original.width * new.pixel_height
     ) > original.height then
    raise exception using
      errcode = '22023',
      message = 'Canvas asset variant dimensions do not match the original asset';
  end if;
  return new;
end;
$$;
