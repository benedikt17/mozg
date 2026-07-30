import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createServerClient = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { middleware } from "@/middleware";

function configureSupabaseEnvironment(): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
}

function request(): NextRequest {
  return new NextRequest("http://127.0.0.1:3000/prototype/desktop");
}

describe("middleware local development mode", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "false");
    createServerClient.mockReset();
    getUser.mockReset();
    createServerClient.mockReturnValue({ auth: { getUser } });
    getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("allows desktop without Supabase configuration in explicit local mode", async () => {
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);

    await expect(middleware(request())).resolves.toMatchObject({ status: 200 });
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
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
