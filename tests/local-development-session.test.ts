import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const getUser = vi.hoisted(() => vi.fn());
const setSession = vi.hoisted(() => vi.fn());
const createUser = vi.hoisted(() => vi.fn());
const listUsers = vi.hoisted(() => vi.fn());
const updateUserById = vi.hoisted(() => vi.fn());
const signInWithPassword = vi.hoisted(() => vi.fn());
const createServerClient = vi.hoisted(() => vi.fn());
const createSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: createSupabaseClient,
}));

const { ensureLocalDevelopmentSession, isLocalSupabaseUrl } =
  await import("@/lib/local-development-session");

function request(): NextRequest {
  return new NextRequest("http://127.0.0.1:3000/prototype/desktop");
}

describe("local development session bootstrap", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    getUser.mockReset();
    setSession.mockReset();
    createUser.mockReset();
    listUsers.mockReset();
    updateUserById.mockReset();
    signInWithPassword.mockReset();
    createServerClient.mockReset();
    createSupabaseClient.mockReset();
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    setSession.mockResolvedValue({ error: null });
    createUser.mockResolvedValue({ error: null });
    listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    updateUserById.mockResolvedValue({ error: null });
    signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: "access", refresh_token: "refresh" },
      },
      error: null,
    });
    createServerClient.mockReturnValue({ auth: { getUser, setSession } });
    createSupabaseClient.mockReturnValue({
      auth: {
        admin: { createUser, listUsers, updateUserById },
        signInWithPassword,
      },
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each(["http://localhost:54321", "http://127.0.0.1:54321"])(
    "accepts the local Supabase target %s",
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(true);
    },
  );

  it.each([
    "https://127.0.0.1:54321",
    "http://127.0.0.1:54322",
    "https://example.supabase.co",
  ])("rejects a non-local Supabase target %s", (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(false);
  });

  it("creates a normal local user session through server-only admin setup", async () => {
    const response = NextResponse.next({ request: request() });

    await expect(
      ensureLocalDevelopmentSession(request(), response),
    ).resolves.toEqual({
      kind: "created",
    });
    expect(createSupabaseClient).toHaveBeenCalledTimes(2);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email_confirm: true }),
    );
    expect(signInWithPassword).toHaveBeenCalledOnce();
    expect(setSession).toHaveBeenCalledWith({
      access_token: "access",
      refresh_token: "refresh",
    });
  });

  it("reuses an existing deterministic user when local Auth reports a duplicate", async () => {
    createUser.mockResolvedValueOnce({
      error: {
        message: "A user with this email address has already been registered",
      },
    });
    listUsers.mockResolvedValueOnce({
      data: {
        users: [
          { id: "local-user", email: "mozg-local-development@example.test" },
        ],
      },
      error: null,
    });

    await expect(
      ensureLocalDevelopmentSession(
        request(),
        NextResponse.next({ request: request() }),
      ),
    ).resolves.toEqual({ kind: "created" });
    expect(updateUserById).toHaveBeenCalledWith(
      "local-user",
      expect.objectContaining({ email_confirm: true }),
    );
    expect(signInWithPassword).toHaveBeenCalledOnce();
  });

  it("does not bootstrap outside local development mode", async () => {
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "false");

    await expect(
      ensureLocalDevelopmentSession(
        request(),
        NextResponse.next({ request: request() }),
      ),
    ).resolves.toEqual({ kind: "skipped" });
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });

  it("fails closed when the service-role key is unavailable", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);

    await expect(
      ensureLocalDevelopmentSession(
        request(),
        NextResponse.next({ request: request() }),
      ),
    ).resolves.toEqual({ kind: "unavailable", reason: "missing-service-key" });
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });
});
