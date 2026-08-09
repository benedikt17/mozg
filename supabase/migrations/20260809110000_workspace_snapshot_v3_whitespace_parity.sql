-- Keep application and SQL V3 non-empty string semantics aligned.
-- JavaScript String.prototype.trim() rejects ASCII whitespace-only identifiers;
-- PostgreSQL btrim(text) only trims spaces by default, so explicitly recognize
-- the full POSIX whitespace class here.

create or replace function public.assert_desktop_snapshot_v3_string(
  record_value jsonb,
  field_name text,
  required_value boolean default true,
  non_empty boolean default false
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not record_value ? field_name then
    if required_value then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
    return;
  end if;
  if jsonb_typeof(record_value -> field_name) <> 'string'
     or (
       non_empty
       and (record_value ->> field_name) ~ '^[[:space:]]*$'
     ) then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;
end;
$$;

create or replace function public.assert_desktop_snapshot_v3_string_array(
  record_value jsonb,
  field_name text,
  non_empty_items boolean default false,
  non_empty_array boolean default false,
  required_value boolean default true
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  item jsonb;
begin
  if not record_value ? field_name then
    if required_value then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
    return;
  end if;
  if jsonb_typeof(record_value -> field_name) <> 'array'
     or (non_empty_array and jsonb_array_length(record_value -> field_name) = 0) then
    raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
  end if;
  for item in select value from jsonb_array_elements(record_value -> field_name) loop
    if jsonb_typeof(item) <> 'string'
       or (
         non_empty_items
         and (item #>> '{}') ~ '^[[:space:]]*$'
       ) then
      raise exception using errcode = '22023', message = 'desktop snapshot validation failed';
    end if;
  end loop;
end;
$$;

revoke all on function public.assert_desktop_snapshot_v3_string(jsonb, text, boolean, boolean)
  from public, anon, authenticated;
revoke all on function public.assert_desktop_snapshot_v3_string_array(jsonb, text, boolean, boolean, boolean)
  from public, anon, authenticated;
