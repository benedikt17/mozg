import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CODEX_CLIENT_ID,
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
});
