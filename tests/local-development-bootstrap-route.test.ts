import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureLocalDevelopmentSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/local-development-session", () => ({
  ensureLocalDevelopmentSession,
}));

const { GET } = await import("@/app/auth/local-development/route");

function request(
  next = "/prototype/desktop",
  origin = "http://127.0.0.1:3000",
): NextRequest {
  return new NextRequest(
    `${origin}/auth/local-development?next=${encodeURIComponent(next)}`,
    { headers: { host: new URL(origin).host } },
  );
}

describe("local development bootstrap route", () => {
  beforeEach(() => ensureLocalDevelopmentSession.mockReset());
  afterEach(() => vi.unstubAllEnvs());

  it("sets the ordinary session through the server-only bootstrap and returns to Desktop", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");
    ensureLocalDevelopmentSession.mockResolvedValue({ kind: "created" });

    const response = await GET(request());

    expect(response.status).toBe(307);
    const redirectUrl = new URL(response.headers.get("location") ?? "");
    expect(redirectUrl.origin).toBe("http://127.0.0.1:3000");
    expect(redirectUrl.pathname).toBe("/prototype/desktop");
    expect(ensureLocalDevelopmentSession).toHaveBeenCalledOnce();
  });

  it("keeps a localhost bootstrap on localhost so its session cookie is reusable", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");
    ensureLocalDevelopmentSession.mockResolvedValue({ kind: "existing" });

    const response = await GET(
      request("/prototype/desktop", "http://localhost:3000"),
    );

    expect(new URL(response.headers.get("location") ?? "").origin).toBe(
      "http://localhost:3000",
    );
  });

  it("fails closed outside local development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "false");

    const response = await GET(request());

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/prototype/desktop",
    );
    expect(ensureLocalDevelopmentSession).not.toHaveBeenCalled();
  });

  it("rejects non-local hosts even when local development mode is enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");

    const response = await GET(
      request("/prototype/desktop", "https://evil.example"),
    );

    expect(response.status).toBe(404);
    expect(ensureLocalDevelopmentSession).not.toHaveBeenCalled();
  });
});
