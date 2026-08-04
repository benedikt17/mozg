import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((path: string): never => {
    throw new Error(`redirect:${path}`);
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { default: Home } = await import("@/app/page");

describe("root route", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockClear();
  });

  it("redirects an unauthenticated user to sign-in without rendering the legacy smoke page", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(Home()).rejects.toThrow("redirect:/sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("redirects an authenticated user to the canonical Desktop route", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    await expect(Home()).rejects.toThrow("redirect:/prototype/desktop");
    expect(redirect).toHaveBeenCalledWith("/prototype/desktop");
  });
});
