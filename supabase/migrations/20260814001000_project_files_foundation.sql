-- Stage A1: standalone Project Files persistence and private Storage foundation.
--
-- Product Projects are currently authoritative inside Desktop Snapshot V3 and use
-- opaque text ids. This migration intentionally does not introduce a foreign key
-- to the legacy public.projects UUID table.

create table public.project_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id text not null,
  parent_folder_id uuid,
  name text not null,
  sort_order bigint not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, project_id, id),
  constraint project_folders_project_id_check
    check (project_id = btrim(project_id) and length(project_id) between 1 and 128),
  constraint project_folders_name_check
    check (
      name = btrim(name)
      and length(name) between 1 and 255
      and position('/' in name) = 0
      and position(chr(92) in name) = 0
    ),
  constraint project_folders_parent_scope_fkey
    foreign key (workspace_id, project_id, parent_folder_id)
    references public.project_folders(workspace_id, project_id, id)
    on delete restrict
);

create unique index project_folders_active_root_name_key
  on public.project_folders (workspace_id, project_id, lower(btrim(name)))
  where parent_folder_id is null and deleted_at is null;

create unique index project_folders_active_child_name_key
  on public.project_folders (
    workspace_id,
    project_id,
    parent_folder_id,
    lower(btrim(name))
  )
  where parent_folder_id is not null and deleted_at is null;

create index project_folders_navigation_idx
  on public.project_folders (workspace_id, project_id, parent_folder_id, sort_order)
  where deleted_at is null;

create table public.project_files (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id),
  project_id text not null,
  folder_id uuid,
  name text not null,
  original_name text not null,
  storage_key text not null unique,
  mime_type text not null,
  byte_size bigint not null,
  checksum text,
  width integer,
  height integer,
  search_tsv tsvector generated always as (
    setweight(to_tsvector('russian'::regconfig, coalesce(name, '')), 'A')
    || setweight(to_tsvector('simple'::regconfig, coalesce(name, '')), 'A')
    || setweight(to_tsvector('simple'::regconfig, coalesce(original_name, '')), 'B')
    || setweight(to_tsvector('simple'::regconfig, coalesce(mime_type, '')), 'C')
  ) stored,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  deleted_at timestamptz,
  unique (workspace_id, project_id, id),
  constraint project_files_project_id_check
    check (project_id = btrim(project_id) and length(project_id) between 1 and 128),
  constraint project_files_name_check
    check (
      name = btrim(name)
      and length(name) between 1 and 255
      and position('/' in name) = 0
      and position(chr(92) in name) = 0
    ),
  constraint project_files_original_name_check
    check (
      original_name = btrim(original_name)
      and length(original_name) between 1 and 255
      and position('/' in original_name) = 0
      and position(chr(92) in original_name) = 0
    ),
  constraint project_files_storage_key_contract_check
    check (storage_key = workspace_id::text || '/' || id::text || '/original'),
  constraint project_files_mime_type_check
    check (
      mime_type = lower(btrim(mime_type))
      and mime_type in (
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/json',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
    ),
  constraint project_files_byte_size_check
    check (byte_size > 0 and byte_size <= 52428800),
  constraint project_files_checksum_check
    check (checksum is null or (btrim(checksum) <> '' and length(checksum) <= 256)),
  constraint project_files_dimensions_check
    check (
      (
        mime_type like 'image/%'
        and width is not null
        and height is not null
        and width > 0
        and height > 0
        and width <= 50000
        and height <= 50000
        and width::bigint * height::bigint <= 250000000
      )
      or
      (
        mime_type not like 'image/%'
        and width is null
        and height is null
      )
    ),
  constraint project_files_folder_scope_fkey
    foreign key (workspace_id, project_id, folder_id)
    references public.project_folders(workspace_id, project_id, id)
    on delete restrict
);

create index project_files_location_idx
  on public.project_files (workspace_id, project_id, folder_id, created_at desc);

create index project_files_active_location_idx
  on public.project_files (workspace_id, project_id, folder_id, created_at desc)
  where deleted_at is null and ready_at is not null;

create index project_files_trash_idx
  on public.project_files (workspace_id, project_id, deleted_at desc)
  where deleted_at is not null;

create index project_files_search_tsv_gin
  on public.project_files using gin(search_tsv);

create table public.file_variants (
  workspace_id uuid not null,
  project_id text not null,
  file_id uuid not null,
  kind text not null,
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint not null,
  pixel_width integer,
  pixel_height integer,
  target_max_edge integer,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  primary key (workspace_id, project_id, file_id, kind),
  constraint file_variants_parent_fkey
    foreign key (workspace_id, project_id, file_id)
    references public.project_files(workspace_id, project_id, id)
    on delete cascade,
  constraint file_variants_kind_check
    check (kind ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  constraint file_variants_storage_path_check
    check (storage_path like workspace_id::text || '/' || file_id::text || '/variants/%'),
  constraint file_variants_mime_type_check
    check (mime_type = 'image/webp'),
  constraint file_variants_byte_size_check
    check (byte_size > 0 and byte_size <= 20971520),
  constraint file_variants_dimensions_check
    check (
      pixel_width is not null
      and pixel_height is not null
      and pixel_width > 0
      and pixel_height > 0
      and pixel_width <= 16384
      and pixel_height <= 16384
    ),
  constraint file_variants_target_edge_check
    check (target_max_edge is null or target_max_edge between 64 and 16384)
);

create index file_variants_parent_idx
  on public.file_variants (workspace_id, project_id, file_id, target_max_edge);

create trigger project_folders_set_updated_at
before update on public.project_folders
for each row execute function public.set_updated_at();

create trigger project_files_set_updated_at
before update on public.project_files
for each row execute function public.set_updated_at();

alter table public.project_folders enable row level security;
alter table public.project_files enable row level security;
alter table public.file_variants enable row level security;

create policy project_folders_select_member
on public.project_folders
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy project_files_select_member
on public.project_files
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    (ready_at is not null and deleted_at is null)
    or public.has_workspace_role(workspace_id, array['owner', 'editor'])
  )
);

create policy file_variants_select_member
on public.file_variants
for select
to authenticated
using (
  ready_at is not null
  and public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.project_files as file_row
    where file_row.workspace_id = file_variants.workspace_id
      and file_row.project_id = file_variants.project_id
      and file_row.id = file_variants.file_id
      and file_row.ready_at is not null
      and file_row.deleted_at is null
  )
);

revoke all on table public.project_folders from public, anon, authenticated;
revoke all on table public.project_files from public, anon, authenticated;
revoke all on table public.file_variants from public, anon, authenticated;
grant select on table public.project_folders to authenticated;
grant select on table public.project_files to authenticated;
grant select on table public.file_variants to authenticated;

create or replace function private.is_workspace_project_id(
  target_workspace_id uuid,
  target_project_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.workspace_snapshots as snapshot_row
    cross join lateral jsonb_array_elements(snapshot_row.snapshot -> 'projects') as project_row
    where snapshot_row.workspace_id = target_workspace_id
      and snapshot_row.schema_version = 3
      and project_row ->> 'id' = target_project_id
  );
$$;

create or replace function private.project_file_storage_key(
  target_workspace_id uuid,
  target_file_id uuid
)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select target_workspace_id::text || '/' || target_file_id::text || '/original';
$$;

create or replace function private.assert_project_file_name(target_name text)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if target_name is null
     or target_name <> btrim(target_name)
     or length(target_name) < 1
     or length(target_name) > 255
     or position('/' in target_name) > 0
     or position(chr(92) in target_name) > 0 then
    raise exception using errcode = '22023', message = 'Project file name is invalid';
  end if;
end;
$$;

create or replace function private.assert_project_file_metadata(
  target_mime_type text,
  target_byte_size bigint,
  target_width integer,
  target_height integer,
  target_checksum text
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if target_mime_type is null
     or target_mime_type <> lower(btrim(target_mime_type))
     or target_mime_type not in (
       'image/png',
       'image/jpeg',
       'image/webp',
       'image/gif',
       'application/pdf',
       'text/plain',
       'text/markdown',
       'application/json',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
       'application/vnd.openxmlformats-officedocument.presentationml.presentation'
     ) then
    raise exception using errcode = '22023', message = 'Unsupported Project file MIME type';
  end if;

  if target_byte_size is null or target_byte_size <= 0 or target_byte_size > 52428800 then
    raise exception using errcode = '22023', message = 'Project file byte size is invalid';
  end if;

  if target_mime_type like 'image/%' then
    if target_width is null or target_height is null
       or target_width <= 0 or target_height <= 0
       or target_width > 50000 or target_height > 50000
       or target_width::bigint * target_height::bigint > 250000000 then
      raise exception using errcode = '22023', message = 'Project image dimensions are invalid';
    end if;
  elsif target_width is not null or target_height is not null then
    raise exception using errcode = '22023', message = 'Non-image Project file dimensions must be null';
  end if;

  if target_checksum is not null
     and (btrim(target_checksum) = '' or length(target_checksum) > 256) then
    raise exception using errcode = '22023', message = 'Project file checksum is invalid';
  end if;
end;
$$;

create or replace function private.assert_project_folder_target(
  target_workspace_id uuid,
  target_project_id text,
  target_folder_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if target_folder_id is not null and not exists (
    select 1
    from public.project_folders as folder_row
    where folder_row.id = target_folder_id
      and folder_row.workspace_id = target_workspace_id
      and folder_row.project_id = target_project_id
      and folder_row.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'Project folder target is unavailable';
  end if;
end;
$$;

create function public.create_project_folder(
  target_workspace_id uuid,
  target_project_id text,
  target_name text,
  target_parent_folder_id uuid default null
)
returns setof public.project_folders
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  next_sort_order bigint;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not private.is_workspace_project_id(target_workspace_id, target_project_id) then
    raise exception using errcode = '42501', message = 'Project folder access denied';
  end if;

  perform private.assert_project_file_name(target_name);
  perform private.assert_project_folder_target(
    target_workspace_id,
    target_project_id,
    target_parent_folder_id
  );

  select coalesce(max(folder_row.sort_order) + 1, 0)
    into next_sort_order
    from public.project_folders as folder_row
   where folder_row.workspace_id = target_workspace_id
     and folder_row.project_id = target_project_id
     and folder_row.parent_folder_id is not distinct from target_parent_folder_id
     and folder_row.deleted_at is null;

  return query
  insert into public.project_folders (
    workspace_id,
    project_id,
    parent_folder_id,
    name,
    sort_order,
    created_by
  )
  values (
    target_workspace_id,
    target_project_id,
    target_parent_folder_id,
    target_name,
    next_sort_order,
    (select auth.uid())
  )
  returning project_folders.*;
end;
$$;

create function public.rename_project_folder(
  target_folder_id uuid,
  target_name text
)
returns setof public.project_folders
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_workspace_id uuid;
begin
  select folder_row.workspace_id
    into target_workspace_id
    from public.project_folders as folder_row
   where folder_row.id = target_folder_id
     and folder_row.deleted_at is null;

  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project folder access denied';
  end if;

  perform private.assert_project_file_name(target_name);

  return query
  update public.project_folders as folder_row
     set name = target_name
   where folder_row.id = target_folder_id
     and folder_row.deleted_at is null
  returning folder_row.*;
end;
$$;

create function public.move_project_folder(
  target_folder_id uuid,
  target_parent_folder_id uuid
)
returns setof public.project_folders
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_workspace_id uuid;
  target_project_id text;
  next_sort_order bigint;
begin
  select folder_row.workspace_id, folder_row.project_id
    into target_workspace_id, target_project_id
    from public.project_folders as folder_row
   where folder_row.id = target_folder_id
     and folder_row.deleted_at is null;

  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project folder access denied';
  end if;

  perform private.assert_project_folder_target(
    target_workspace_id,
    target_project_id,
    target_parent_folder_id
  );

  if target_parent_folder_id = target_folder_id or exists (
    with recursive descendants(id) as (
      select folder_row.id
      from public.project_folders as folder_row
      where folder_row.id = target_folder_id
        and folder_row.workspace_id = target_workspace_id
        and folder_row.project_id = target_project_id
        and folder_row.deleted_at is null
      union all
      select child.id
      from public.project_folders as child
      join descendants as parent on parent.id = child.parent_folder_id
      where child.workspace_id = target_workspace_id
        and child.project_id = target_project_id
        and child.deleted_at is null
    )
    select 1 from descendants where id = target_parent_folder_id
  ) then
    raise exception using errcode = '22023', message = 'Project folder cycle is not allowed';
  end if;

  select coalesce(max(folder_row.sort_order) + 1, 0)
    into next_sort_order
    from public.project_folders as folder_row
   where folder_row.workspace_id = target_workspace_id
     and folder_row.project_id = target_project_id
     and folder_row.parent_folder_id is not distinct from target_parent_folder_id
     and folder_row.deleted_at is null
     and folder_row.id <> target_folder_id;

  return query
  update public.project_folders as folder_row
     set parent_folder_id = target_parent_folder_id,
         sort_order = next_sort_order
   where folder_row.id = target_folder_id
     and folder_row.deleted_at is null
  returning folder_row.*;
end;
$$;

create function public.reserve_project_file(
  target_workspace_id uuid,
  target_project_id text,
  target_file_id uuid,
  target_folder_id uuid,
  target_name text,
  target_original_name text,
  target_mime_type text,
  target_byte_size bigint,
  target_width integer default null,
  target_height integer default null,
  target_checksum text default null
)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'editor'])
     or not private.is_workspace_project_id(target_workspace_id, target_project_id) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  perform private.assert_project_file_name(target_name);
  perform private.assert_project_file_name(target_original_name);
  perform private.assert_project_file_metadata(
    target_mime_type,
    target_byte_size,
    target_width,
    target_height,
    target_checksum
  );
  perform private.assert_project_folder_target(
    target_workspace_id,
    target_project_id,
    target_folder_id
  );

  return query
  insert into public.project_files (
    id,
    workspace_id,
    project_id,
    folder_id,
    name,
    original_name,
    storage_key,
    mime_type,
    byte_size,
    checksum,
    width,
    height,
    created_by
  )
  values (
    target_file_id,
    target_workspace_id,
    target_project_id,
    target_folder_id,
    target_name,
    target_original_name,
    private.project_file_storage_key(target_workspace_id, target_file_id),
    target_mime_type,
    target_byte_size,
    target_checksum,
    target_width,
    target_height,
    (select auth.uid())
  )
  returning project_files.*;
end;
$$;

create function public.finalize_project_file(target_file_id uuid)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public, private, storage
as $$
declare
  target_workspace_id uuid;
  target_storage_key text;
  target_mime_type text;
  target_byte_size bigint;
  target_ready_at timestamptz;
  object_mime_type text;
  object_byte_size bigint;
begin
  select file_row.workspace_id,
         file_row.storage_key,
         file_row.mime_type,
         file_row.byte_size,
         file_row.ready_at
    into target_workspace_id,
         target_storage_key,
         target_mime_type,
         target_byte_size,
         target_ready_at
    from public.project_files as file_row
   where file_row.id = target_file_id
     and file_row.deleted_at is null;

  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  if target_ready_at is null then
    select lower(object_row.metadata ->> 'mimetype'),
           nullif(object_row.metadata ->> 'size', '')::bigint
      into object_mime_type, object_byte_size
      from storage.objects as object_row
     where object_row.bucket_id = 'project-files'
       and object_row.name = target_storage_key;

    if object_mime_type is null or object_byte_size is null then
      raise exception using errcode = '22023', message = 'Project file object is missing';
    end if;

    if object_mime_type <> target_mime_type or object_byte_size <> target_byte_size then
      raise exception using errcode = '22023', message = 'Project file object metadata does not match reservation';
    end if;
  end if;

  return query
  update public.project_files as file_row
     set ready_at = coalesce(file_row.ready_at, now())
   where file_row.id = target_file_id
     and file_row.deleted_at is null
  returning file_row.*;
end;
$$;

create function public.rename_project_file(
  target_file_id uuid,
  target_name text
)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_workspace_id uuid;
begin
  select file_row.workspace_id
    into target_workspace_id
    from public.project_files as file_row
   where file_row.id = target_file_id;

  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  perform private.assert_project_file_name(target_name);

  return query
  update public.project_files as file_row
     set name = target_name
   where file_row.id = target_file_id
  returning file_row.*;
end;
$$;

create function public.move_project_file(
  target_file_id uuid,
  target_folder_id uuid
)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_workspace_id uuid;
  target_project_id text;
begin
  select file_row.workspace_id, file_row.project_id
    into target_workspace_id, target_project_id
    from public.project_files as file_row
   where file_row.id = target_file_id;

  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  perform private.assert_project_folder_target(
    target_workspace_id,
    target_project_id,
    target_folder_id
  );

  return query
  update public.project_files as file_row
     set folder_id = target_folder_id
   where file_row.id = target_file_id
  returning file_row.*;
end;
$$;

create function public.delete_project_file(target_file_id uuid)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_workspace_id uuid;
begin
  select file_row.workspace_id
    into target_workspace_id
    from public.project_files as file_row
   where file_row.id = target_file_id;

  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  return query
  update public.project_files as file_row
     set deleted_at = coalesce(file_row.deleted_at, now())
   where file_row.id = target_file_id
  returning file_row.*;
end;
$$;

create function public.restore_project_file(target_file_id uuid)
returns setof public.project_files
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_workspace_id uuid;
  target_project_id text;
  target_folder_id uuid;
begin
  select file_row.workspace_id, file_row.project_id, file_row.folder_id
    into target_workspace_id, target_project_id, target_folder_id
    from public.project_files as file_row
   where file_row.id = target_file_id;

  if target_workspace_id is null
     or not public.has_workspace_role(target_workspace_id, array['owner', 'editor']) then
    raise exception using errcode = '42501', message = 'Project file access denied';
  end if;

  perform private.assert_project_folder_target(
    target_workspace_id,
    target_project_id,
    target_folder_id
  );

  return query
  update public.project_files as file_row
     set deleted_at = null
   where file_row.id = target_file_id
  returning file_row.*;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy project_files_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-files'
  and (
    exists (
      select 1
      from public.project_files as file_row
      where file_row.storage_key = name
        and file_row.deleted_at is null
        and public.is_workspace_member(file_row.workspace_id)
        and (
          file_row.ready_at is not null
          or public.has_workspace_role(file_row.workspace_id, array['owner', 'editor'])
        )
    )
    or exists (
      select 1
      from public.file_variants as variant_row
      join public.project_files as file_row
        on file_row.workspace_id = variant_row.workspace_id
       and file_row.project_id = variant_row.project_id
       and file_row.id = variant_row.file_id
      where variant_row.storage_path = name
        and variant_row.ready_at is not null
        and file_row.ready_at is not null
        and file_row.deleted_at is null
        and public.is_workspace_member(file_row.workspace_id)
    )
  )
);

create policy project_files_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-files'
  and exists (
    select 1
    from public.project_files as file_row
    where file_row.storage_key = name
      and file_row.ready_at is null
      and file_row.deleted_at is null
      and public.has_workspace_role(file_row.workspace_id, array['owner', 'editor'])
  )
);

revoke all on function private.is_workspace_project_id(uuid, text) from public, anon, authenticated;
revoke all on function private.project_file_storage_key(uuid, uuid) from public, anon, authenticated;
revoke all on function private.assert_project_file_name(text) from public, anon, authenticated;
revoke all on function private.assert_project_file_metadata(text, bigint, integer, integer, text) from public, anon, authenticated;
revoke all on function private.assert_project_folder_target(uuid, text, uuid) from public, anon, authenticated;

revoke all on function public.create_project_folder(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.rename_project_folder(uuid, text) from public, anon, authenticated;
revoke all on function public.move_project_folder(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reserve_project_file(uuid, text, uuid, uuid, text, text, text, bigint, integer, integer, text) from public, anon, authenticated;
revoke all on function public.finalize_project_file(uuid) from public, anon, authenticated;
revoke all on function public.rename_project_file(uuid, text) from public, anon, authenticated;
revoke all on function public.move_project_file(uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_project_file(uuid) from public, anon, authenticated;
revoke all on function public.restore_project_file(uuid) from public, anon, authenticated;

grant execute on function public.create_project_folder(uuid, text, text, uuid) to authenticated;
grant execute on function public.rename_project_folder(uuid, text) to authenticated;
grant execute on function public.move_project_folder(uuid, uuid) to authenticated;
grant execute on function public.reserve_project_file(uuid, text, uuid, uuid, text, text, text, bigint, integer, integer, text) to authenticated;
grant execute on function public.finalize_project_file(uuid) to authenticated;
grant execute on function public.rename_project_file(uuid, text) to authenticated;
grant execute on function public.move_project_file(uuid, uuid) to authenticated;
grant execute on function public.delete_project_file(uuid) to authenticated;
grant execute on function public.restore_project_file(uuid) to authenticated;

comment on table public.project_files is
  'Project-scoped shared asset metadata. Original binaries live in private project-files Storage.';
comment on column public.project_files.project_id is
  'Opaque Desktop Snapshot V3 Product Project id; intentionally not a FK to public.projects.';
comment on column public.project_files.name is
  'Mutable display name; original_name preserves the uploaded filename.';
comment on column public.project_files.storage_key is
  'Stable immutable object key independent of folder and display names.';
comment on table public.file_variants is
  'Disposable derived file previews/caches. Originals remain authoritative in project_files.';
