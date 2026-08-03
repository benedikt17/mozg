import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createServerClient = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { config, middleware } from "@/middleware";

function configureSupabaseEnvironment(): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
}

function request(origin = "http://127.0.0.1:3000"): NextRequest {
  return new NextRequest(`${origin}/prototype/desktop`);
}

describe("middleware local development mode", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "false");
    configureSupabaseEnvironment();
    createServerClient.mockReset();
    getUser.mockReset();
    createServerClient.mockReturnValue({ auth: { getUser } });
    getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("routes unauthenticated local Desktop through the server bootstrap", async () => {
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");

    const response = await middleware(request());

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/auth/local-development",
    );
  });

  it("excludes the web manifest from the local Auth bootstrap matcher", () => {
    expect(config.matcher).toContain(
      "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    );
  });

  it("allows local routes with an existing authenticated session", async () => {
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");
    getUser.mockResolvedValue({
      data: { user: { id: "local-user" } },
      error: null,
    });

    const response = await middleware(request());

    expect(response.status).toBe(200);
  });

  it("keeps normal development authenticated when the flag is absent", async () => {
    configureSupabaseEnvironment();

    await middleware(request());

    expect(createServerClient).toHaveBeenCalledOnce();
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("does not open protected routes when Supabase configuration is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);

    await expect(middleware(request())).rejects.toThrow();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("fails closed in production even when the flag is true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");
    configureSupabaseEnvironment();

    await middleware(request());

    expect(createServerClient).toHaveBeenCalledOnce();
    expect(getUser).toHaveBeenCalledOnce();
  });
});
