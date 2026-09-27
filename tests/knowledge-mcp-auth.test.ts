import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  hashSecret,
  matchesPkce,
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

  it("accepts only the configured MCP resource and the published Work callback", async () => {
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
        }),
      ),
    );
    expect(await validWorkClient(WORK_CLIENT_ID, WORK_REDIRECT_URI)).toBe(true);
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
});
