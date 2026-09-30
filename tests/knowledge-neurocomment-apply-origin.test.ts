import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
const { POST } = await import("@/app/api/knowledge-neurocomments/apply/route");

function request(url: string, headers: Record<string, string>): Request {
  return new Request(`${url}/api/knowledge-neurocomments/apply`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      annotationId: "72000000-0000-4000-8000-000000000010",
    }),
  });
}

describe("neurocomment apply origin boundary", () => {
  beforeEach(() => {
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it.each([
    ["http://localhost:3000", "127.0.0.1:3000", "http://127.0.0.1:3000"],
    ["http://localhost:3000", "localhost:3000", "http://localhost:3000"],
    ["https://internal.example", "mozg.example", "https://mozg.example"],
  ])(
    "accepts the incoming origin and still requires auth: %s, %s",
    async (url, host, origin) => {
      const response = await POST(request(url, { host, origin }));
      expect(response.status).toBe(401);
      expect(getUser).toHaveBeenCalledOnce();
    },
  );

  it.each([
    "https://foreign.example",
    "http://mozg.example",
    "https://mozg.example:8443",
    "null",
    "https://mozg.example/path",
  ])("rejects %s before auth or a database write", async (origin) => {
    const response = await POST(
      request("https://mozg.example", { host: "mozg.example", origin }),
    );
    expect(response.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("does not trust a spoofed forwarded host", async () => {
    const response = await POST(
      request("https://mozg.example", {
        host: "mozg.example",
        origin: "https://foreign.example",
        "x-forwarded-host": "foreign.example",
      }),
    );
    expect(response.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("keeps authentication mandatory for requests without Origin", async () => {
    const response = await POST(request("https://mozg.example", {}));
    expect(response.status).toBe(401);
    expect(getUser).toHaveBeenCalledOnce();
  });
});
