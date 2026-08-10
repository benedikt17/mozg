import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createServerClient = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { config, proxy } from "@/proxy";

const LOCAL_ONLY_PROTOTYPE_PATHS = [
  "/prototype/canvas-image-ingestion-lab",
  "/prototype/canvas-react-flow-ingestion-spike",
  "/prototype/infinite-canvas-local-shell",
] as const;

function configureSupabaseEnvironment(): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
}

function request(
  pathname = "/prototype/desktop",
  origin = "http://127.0.0.1:3000",
): NextRequest {
  return new NextRequest(`${origin}${pathname}`);
}

describe("proxy local development and cloud route policy", () => {
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

    const response = await proxy(request());

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

    const response = await proxy(request());

    expect(response.status).toBe(200);
  });

  it("keeps normal development authenticated when the flag is absent", async () => {
    configureSupabaseEnvironment();

    await proxy(request());

    expect(createServerClient).toHaveBeenCalledOnce();
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("does not open protected routes when Supabase configuration is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);

    await expect(proxy(request())).rejects.toThrow();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("fails closed in production even when the local flag is true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");
    configureSupabaseEnvironment();

    await proxy(request());

    expect(createServerClient).toHaveBeenCalledOnce();
    expect(getUser).toHaveBeenCalledOnce();
  });

  it.each(LOCAL_ONLY_PROTOTYPE_PATHS)(
    "returns 404 for cloud-only access to %s before Supabase auth",
    async (pathname) => {
      const response = await proxy(request(pathname));

      expect(response.status).toBe(404);
      expect(createServerClient).not.toHaveBeenCalled();
      expect(getUser).not.toHaveBeenCalled();
    },
  );

  it.each(LOCAL_ONLY_PROTOTYPE_PATHS)(
    "keeps %s available behind local development auth",
    async (pathname) => {
      vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");

      const response = await proxy(request(pathname));

      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
        "/auth/local-development",
      );
      expect(createServerClient).toHaveBeenCalledOnce();
      expect(getUser).toHaveBeenCalledOnce();
    },
  );
});
