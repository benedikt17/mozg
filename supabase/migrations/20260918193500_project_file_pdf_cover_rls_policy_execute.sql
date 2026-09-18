-- RLS policies execute their helper as the active database role. The function
-- remains inaccessible through the private schema, but authenticated policy
-- evaluation needs this narrow EXECUTE grant.

grant execute on function private.can_read_project_file_variant(
  uuid, text, uuid, text, timestamptz
) to authenticated;
