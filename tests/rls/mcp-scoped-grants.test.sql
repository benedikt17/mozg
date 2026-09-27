begin;

select plan(20);

select has_table('public', 'mcp_oauth_grants', 'MCP grants table exists');
select has_table('public', 'mcp_oauth_codes', 'MCP codes table exists');
select has_table('public', 'mcp_oauth_tokens', 'MCP tokens table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.mcp_oauth_grants'::regclass),
  true, 'grants have RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.mcp_oauth_codes'::regclass),
  true, 'codes have RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.mcp_oauth_tokens'::regclass),
  true, 'tokens have RLS'
);

select is(has_table_privilege('service_role', 'public.mcp_oauth_grants', 'SELECT'), true, 'server can read grants');
select is(has_table_privilege('service_role', 'public.mcp_oauth_codes', 'INSERT'), true, 'server can issue codes');
select is(has_table_privilege('service_role', 'public.mcp_oauth_tokens', 'UPDATE'), true, 'server can consume tokens');

select is(has_table_privilege('anon', 'public.mcp_oauth_grants', 'SELECT'), false, 'anonymous cannot read grants');
select is(has_table_privilege('anon', 'public.mcp_oauth_codes', 'INSERT'), false, 'anonymous cannot issue codes');
select is(has_table_privilege('anon', 'public.mcp_oauth_tokens', 'SELECT'), false, 'anonymous cannot read tokens');
select is(has_table_privilege('authenticated', 'public.mcp_oauth_grants', 'SELECT'), false, 'user cannot read grants');
select is(has_table_privilege('authenticated', 'public.mcp_oauth_grants', 'INSERT'), false, 'user cannot forge grants');
select is(has_table_privilege('authenticated', 'public.mcp_oauth_codes', 'SELECT'), false, 'user cannot read codes');
select is(has_table_privilege('authenticated', 'public.mcp_oauth_codes', 'UPDATE'), false, 'user cannot consume codes');
select is(has_table_privilege('authenticated', 'public.mcp_oauth_tokens', 'SELECT'), false, 'user cannot read tokens');
select is(has_table_privilege('authenticated', 'public.mcp_oauth_tokens', 'INSERT'), false, 'user cannot issue tokens');
select is(has_table_privilege('authenticated', 'public.mcp_oauth_tokens', 'UPDATE'), false, 'user cannot rotate tokens');
select is(has_table_privilege('authenticated', 'public.mcp_oauth_tokens', 'DELETE'), false, 'user cannot delete tokens');

select * from finish();
rollback;
