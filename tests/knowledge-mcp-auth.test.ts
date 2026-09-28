import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CODEX_CLIENT_ID,
  CODEX_CLI_STABLE_CLIENT_ID,
  CODEX_REDIRECT_URI,
  hashSecret,
  matchesPkce,
  NEUROCOMMENT_SCOPE,
  normalizeKnowledgeScope,
  newSecret,
  validPkceChallenge,
  validResource,
  validWorkClient,
  verifyMcpToken,
  WORK_CLIENT_ID,
  WORK_REDIRECT_URI,
} from "@/lib/knowledge-mcp/scoped-auth";
import { validateAuthorizationRequest } from "@/app/oauth/authorize/flow";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("scoped Knowledge MCP authorization", () => {
  it("keeps old grants read-only and requires an exact separate neurocomment scope", () => {
    expect(normalizeKnowledgeScope("knowledge:read")).toBe("knowledge:read");
    expect(
      normalizeKnowledgeScope("knowledge:neurocomment:create knowledge:read"),
    ).toBe(NEUROCOMMENT_SCOPE);
    expect(normalizeKnowledgeScope("knowledge:neurocomment:create")).toBeNull();
    expect(
      normalizeKnowledgeScope("knowledge:read knowledge:files:write"),
    ).toBeNull();
  });
  it("never accepts an ordinary Supabase JWT as an MCP access token", async () => {
    expect(
      await verifyMcpToken(
        "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature",
      ),
    ).toBeNull();
  });

  it("uses one-time random secrets and hashes them before storage", () => {
    const first = newSecret();
    const second = newSecret();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
    expect(hashSecret(first)).toHaveLength(64);
    expect(hashSecret(first)).not.toContain(first);
  });

  it("requires an S256 PKCE verifier with its original exact challenge", () => {
    const verifier = "a".repeat(43);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(validPkceChallenge(challenge)).toBe(true);
    expect(matchesPkce(verifier, challenge)).toBe(true);
    expect(matchesPkce("b".repeat(43), challenge)).toBe(false);
    expect(matchesPkce("short", challenge)).toBe(false);
    expect(validPkceChallenge("short")).toBe(false);
  });

  it("accepts only the configured MCP resource and published ChatGPT callbacks", async () => {
    vi.stubEnv("MOZG_MCP_SCOPED_AUTH", "enabled");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
    vi.stubEnv("MOZG_MCP_PUBLIC_URL", "https://preview.example.test/api/mcp");
    expect(validResource("https://preview.example.test/api/mcp")).toBe(true);
    expect(validResource("https://production.example.test/api/mcp")).toBe(
      false,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          client_id: WORK_CLIENT_ID,
          redirect_uris: [WORK_REDIRECT_URI],
          token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
        }),
      ),
    );
    expect(await validWorkClient(WORK_CLIENT_ID, WORK_REDIRECT_URI)).toBe(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          client_id: CODEX_CLIENT_ID,
          redirect_uris: [CODEX_REDIRECT_URI],
          token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
        }),
      ),
    );
    expect(await validWorkClient(CODEX_CLIENT_ID, CODEX_REDIRECT_URI)).toBe(
      true,
    );
    expect(await validWorkClient(CODEX_CLIENT_ID, WORK_REDIRECT_URI)).toBe(
      false,
    );
    expect(await validWorkClient(WORK_CLIENT_ID, CODEX_REDIRECT_URI)).toBe(
      false,
    );
    expect(
      await validWorkClient(WORK_CLIENT_ID, "https://attacker.test/callback"),
    ).toBe(false);
    expect(
      await validWorkClient(
        "https://attacker.test/client.json",
        WORK_REDIRECT_URI,
      ),
    ).toBe(false);
  });

  it("accepts Codex CLI's portless metadata callback with a variable loopback port", async () => {
    const clientId = "https://chatgpt.com/oauth/codex/Abc_123-def/client.json";
    const registered = "http://127.0.0.1/callback/Abc_123-def";
    const fetchClient = vi.fn(async () =>
      Response.json({
        client_id: clientId,
        redirect_uris: [registered],
        token_endpoint_auth_methods_supported: ["none"],
      }),
    );
    vi.stubGlobal("fetch", fetchClient);

    expect(await validWorkClient(clientId, registered)).toBe(true);
    expect(
      await validWorkClient(
        clientId,
        "http://127.0.0.1:49152/callback/Abc_123-def",
      ),
    ).toBe(true);
    expect(fetchClient).toHaveBeenCalledWith(clientId, expect.any(Object));
    expect(
      await validWorkClient(
        clientId,
        "http://127.0.0.1:65536/callback/Abc_123-def",
      ),
    ).toBe(false);
    expect(
      await validWorkClient(
        clientId,
        "http://localhost:49152/callback/Abc_123-def",
      ),
    ).toBe(false);
    expect(
      await validWorkClient(
        clientId,
        "http://127.0.0.1:49152/callback/Other123",
      ),
    ).toBe(false);
    expect(
      await validWorkClient(
        clientId,
        "https://attacker.test/callback/Abc_123-def",
      ),
    ).toBe(false);
    expect(
      await validWorkClient(
        "https://attacker.test/oauth/codex/Abc_123-def/client.json",
        registered,
      ),
    ).toBe(false);
    expect(fetchClient).toHaveBeenCalledTimes(2);
  });

  it("accepts Codex's stable published client with its portless callback", async () => {
    const fetchClient = vi.fn(async () =>
      Response.json({
        client_id: CODEX_CLI_STABLE_CLIENT_ID,
        redirect_uris: [
          "http://127.0.0.1/callback",
          "http://localhost/callback",
        ],
        token_endpoint_auth_methods_supported: ["none"],
      }),
    );
    vi.stubGlobal("fetch", fetchClient);
    expect(
      await validWorkClient(
        CODEX_CLI_STABLE_CLIENT_ID,
        "http://127.0.0.1:63183/callback",
      ),
    ).toBe(true);
    expect(
      await validWorkClient(
        CODEX_CLI_STABLE_CLIENT_ID,
        "http://127.0.0.1/callback",
      ),
    ).toBe(true);
    expect(
      await validWorkClient(
        CODEX_CLI_STABLE_CLIENT_ID,
        "http://127.0.0.1:63183/callback/other-id",
      ),
    ).toBe(false);
    expect(
      await validWorkClient(
        CODEX_CLI_STABLE_CLIENT_ID,
        "http://localhost:63183/callback",
      ),
    ).toBe(false);
    expect(fetchClient).toHaveBeenCalledTimes(2);
  });

  it("accepts the actual Codex desktop authorization request shape", async () => {
    vi.stubEnv("MOZG_MCP_SCOPED_AUTH", "enabled");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
    vi.stubEnv(
      "MOZG_MCP_PUBLIC_URL",
      "https://mozg-production.vercel.app/api/mcp",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          client_id: CODEX_CLI_STABLE_CLIENT_ID,
          redirect_uris: ["http://127.0.0.1/callback"],
          token_endpoint_auth_methods_supported: ["none"],
        }),
      ),
    );
    const params = new URLSearchParams({
      response_type: "code",
      client_id: CODEX_CLI_STABLE_CLIENT_ID,
      state: "64M6uo6EocAFJJeJjGPEcQ",
      code_challenge: "gU3kodPj_f6nlC8BDaQeeHwmWF9cSXhCkB1ugYgpKxM",
      code_challenge_method: "S256",
      redirect_uri: "http://127.0.0.1:63183/callback",
      scope: "knowledge:read knowledge:neurocomment:create",
      resource: "https://mozg-production.vercel.app/api/mcp",
    });
    expect(await validateAuthorizationRequest(params)).toMatchObject({
      clientId: CODEX_CLI_STABLE_CLIENT_ID,
      scope: NEUROCOMMENT_SCOPE,
    });
  });
});
