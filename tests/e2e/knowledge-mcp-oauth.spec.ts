import { createHash } from "node:crypto";
import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { parseDesktopCloudSnapshotRow } from "@/prototype/persistence/cloud-snapshot-bridge";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

test("Work OAuth issues an MCP-only credential, rotates it, and revokes it", async ({
  page,
  request,
}) => {
  test.skip(!process.env.MOZG_MCP_SCOPED_AUTH, "needs isolated local Supabase");
  const resource = process.env.MOZG_MCP_PUBLIC_URL!;
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const clientId = "https://chatgpt.com/oauth/client.json";
  const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";

  const metadata = await request.get("/.well-known/oauth-authorization-server");
  expect(metadata.ok()).toBe(true);
  expect(
    (await metadata.json()).token_endpoint_auth_methods_supported,
  ).toContain("none");

  await page.route(`${redirectUri}**`, async (route) =>
    route.fulfill({ status: 200, body: "OAuth callback intercepted by test" }),
  );
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "e2e-work",
    scope: "knowledge:read",
    resource,
  });
  await page.goto(`/oauth/authorize?${params}`);
  await expect(
    page.getByRole("heading", { name: "Войти в MOZG" }),
  ).toBeVisible();
  await page.getByLabel("Email").fill(E2E_USER_EMAIL);
  await page.getByLabel("Пароль").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Подключить «МОЗГ» к нейронке" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Разрешить чтение" }).click();
  await expect(page).toHaveURL(
    /chatgpt\.com\/connector_platform_oauth_redirect/,
  );
  const callback = new URL(page.url());
  expect(callback.searchParams.get("state")).toBe("e2e-work");
  expect(callback.searchParams.get("iss")).toBe(new URL(resource).origin);
  const code = callback.searchParams.get("code");
  expect(code).toBeTruthy();

  const form = {
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code: code!,
    code_verifier: verifier,
    resource,
  };
  const invalidPkce = await request.post("/oauth/token", {
    form: { ...form, code_verifier: "b".repeat(43) },
  });
  expect(invalidPkce.status()).toBe(400);
  const exchange = await request.post("/oauth/token", { form });
  expect(exchange.ok()).toBe(true);
  const tokens = await exchange.json();
  expect(tokens.access_token).toMatch(/^mozg_mcp_[A-Za-z0-9_-]{43}$/);
  expect(tokens.refresh_token).toMatch(/^mozg_mcp_refresh_[A-Za-z0-9_-]{43}$/);
  expect((await request.post("/oauth/token", { form })).status()).toBe(400);

  const directApi = await request.get(
    `${process.env.E2E_SUPABASE_URL}/rest/v1/workspace_snapshots?select=workspace_id`,
    {
      headers: {
        apikey: process.env.E2E_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${tokens.access_token}`,
      },
    },
  );
  expect(directApi.status()).toBeGreaterThanOrEqual(400);

  const supabaseUrl = process.env.E2E_SUPABASE_URL!;
  const userClient = createClient(
    supabaseUrl,
    process.env.E2E_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const login = await userClient.auth.signInWithPassword({
    email: E2E_USER_EMAIL,
    password: E2E_USER_PASSWORD,
  });
  expect(login.error).toBeNull();
  const service = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const membership = await service
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", login.data.user!.id);
  expect(membership.error).toBeNull();
  expect(membership.data).toHaveLength(1);
  const workspaceId = membership.data![0].workspace_id;
  const workspace = await service
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single();
  const snapshot = await service
    .from("workspace_snapshots")
    .select("workspace_id, schema_version, snapshot, revision, updated_at")
    .eq("workspace_id", workspaceId)
    .single();
  expect(workspace.error).toBeNull();
  expect(snapshot.error).toBeNull();
  expect(
    parseDesktopCloudSnapshotRow(snapshot.data!, workspace.data!.name).kind,
  ).toBe("ready");

  const mcp = (
    bearer: string,
    method = "tools/list",
    params: Record<string, unknown> = {},
  ) =>
    request.post("/api/mcp", {
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      data: { jsonrpc: "2.0", id: 1, method, params },
    });
  const listedTools = await mcp(tokens.access_token);
  expect(listedTools.status()).toBe(200);
  const toolsResult = await listedTools.json();
  expect(
    toolsResult.result.tools.map((tool: { name: string }) => tool.name),
  ).toEqual(
    expect.arrayContaining([
      "list_knowledge_documents",
      "read_knowledge_document",
      "search_knowledge_documents",
    ]),
  );
  const listedDocuments = await mcp(tokens.access_token, "tools/call", {
    name: "list_knowledge_documents",
    arguments: { limit: 50 },
  });
  expect(listedDocuments.status()).toBe(200);
  const documents = JSON.parse(
    (await listedDocuments.json()).result.content[0].text,
  );
  expect(documents.total).toBeGreaterThan(0);
  const readDocument = await mcp(tokens.access_token, "tools/call", {
    name: "read_knowledge_document",
    arguments: { documentId: documents.items[0].id },
  });
  expect(readDocument.status()).toBe(200);
  const article = JSON.parse(
    (await readDocument.json()).result.content[0].text,
  );
  expect(article.document.id).toBe(documents.items[0].id);
  expect(typeof article.document.markdown).toBe("string");
  expect(article.revision).toBe(documents.revision);
  const rotated = await request.post("/oauth/token", {
    form: {
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: tokens.refresh_token,
      resource,
    },
  });
  expect(rotated.ok()).toBe(true);
  const nextTokens = await rotated.json();
  expect(nextTokens.access_token).not.toBe(tokens.access_token);
  expect(
    (
      await request.post("/oauth/token", {
        form: {
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: tokens.refresh_token,
          resource,
        },
      })
    ).status(),
  ).toBe(400);
  expect((await mcp(nextTokens.access_token)).status()).toBe(200);
  const revoke = await request.post("/oauth/revoke", {
    form: { client_id: clientId, token: nextTokens.refresh_token },
  });
  expect(revoke.ok()).toBe(true);
  expect((await mcp(nextTokens.access_token)).status()).toBe(401);
});
