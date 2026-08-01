-- Canvas title changes use a narrow SECURITY DEFINER RPC because authenticated
-- clients intentionally do not have direct UPDATE privileges on public.canvases.

create function public.rename_canvas(
  target_canvas_id uuid,
  target_title text
)
returns table (
  id uuid,
  workspace_id uuid,
  title text,
  schema_version smallint,
  revision bigint,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_workspace_id uuid;
  current_deleted_at timestamptz;
begin
  select canvases.workspace_id, canvases.deleted_at
    into current_workspace_id, current_deleted_at
    from public.canvases
   where canvases.id = target_canvas_id;

  if current_workspace_id is null
     or current_deleted_at is not null
     or not public.has_workspace_role(current_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Canvas access denied';
  end if;

  perform public.assert_canvas_title(target_title);

  return query
  update public.canvases
     set title = target_title
   where canvases.id = target_canvas_id
     and canvases.deleted_at is null
  returning
    canvases.id,
    canvases.workspace_id,
    canvases.title,
    canvases.schema_version,
    canvases.revision,
    canvases.created_at,
    canvases.updated_at,
    canvases.deleted_at;

  if not found then
    raise exception using errcode = '42501', message = 'Canvas access denied';
  end if;
end;
$$;

revoke all on function public.rename_canvas(uuid, text) from public, anon, authenticated;
grant execute on function public.rename_canvas(uuid, text) to authenticated;
