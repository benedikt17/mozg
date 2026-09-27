-- OAuth credentials issued by MOZG for Knowledge MCP only. Supabase user JWTs
-- are never sent to external MCP clients. These tables are server-only.
create table public.mcp_oauth_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  resource text not null,
  scope text not null default 'knowledge:read' check (scope = 'knowledge:read'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz
);

create table public.mcp_oauth_codes (
  code_hash text primary key check (length(code_hash) = 64),
  grant_id uuid not null references public.mcp_oauth_grants(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table public.mcp_oauth_tokens (
  token_hash text primary key check (length(token_hash) = 64),
  grant_id uuid not null references public.mcp_oauth_grants(id) on delete cascade,
  kind text not null check (kind in ('access', 'refresh')),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index mcp_oauth_grants_user_id_idx on public.mcp_oauth_grants(user_id);
create index mcp_oauth_codes_grant_id_idx on public.mcp_oauth_codes(grant_id);
create index mcp_oauth_tokens_grant_id_idx on public.mcp_oauth_tokens(grant_id);

alter table public.mcp_oauth_grants enable row level security;
alter table public.mcp_oauth_codes enable row level security;
alter table public.mcp_oauth_tokens enable row level security;

revoke all on public.mcp_oauth_grants from public, anon, authenticated;
revoke all on public.mcp_oauth_codes from public, anon, authenticated;
revoke all on public.mcp_oauth_tokens from public, anon, authenticated;
grant all on public.mcp_oauth_grants to service_role;
grant all on public.mcp_oauth_codes to service_role;
grant all on public.mcp_oauth_tokens to service_role;
