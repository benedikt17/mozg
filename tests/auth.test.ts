import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOAuthMock = vi.hoisted(() => vi.fn());
const exchangeCodeForSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
      signInWithOAuth: signInWithOAuthMock,
    },
  })),
}));

import { GET as startGoogleOAuth } from "@/app/auth/google/route";
import { GET as finishGoogleOAuth } from "@/app/auth/callback/route";
import {
  getApplicationOrigin,
  getSafeRedirectPath,
  getSignInErrorMessage,
  getOAuthErrorMessage,
} from "@/lib/auth/safe-redirect";

describe("getSafeRedirectPath", () => {
  it("allows local application paths", () => {
    expect(getSafeRedirectPath("/prototype/desktop?section=tasks")).toBe(
      "/prototype/desktop?section=tasks",
    );
  });

  it.each([
    null,
    "",
    "https://example.com",
    "//example.com",
    "javascript:alert(1)",
    "prototype/desktop",
  ])("falls back for unsafe redirect target %s", (value) => {
    expect(getSafeRedirectPath(value)).toBe("/prototype/desktop");
  });

  it("rejects malformed local redirect targets", () => {
    expect(getSafeRedirectPath("/%E0%A4%A")).toBe("/prototype/desktop");
  });
});

describe("local application origin", () => {
  it("uses the canonical loopback origin for both local hostnames", () => {
    expect(getApplicationOrigin(new URL("http://127.0.0.1:3000"))).toBe(
      "http://127.0.0.1:3000",
    );
    expect(getApplicationOrigin(new URL("http://localhost:3000"))).toBe(
      "http://127.0.0.1:3000",
    );
  });
});

describe("OAuth errors", () => {
  it("is safe for users", () => {
    expect(getOAuthErrorMessage()).not.toMatch(/supabase|stack|token|code/i);
  });
});

describe("getSignInErrorMessage", () => {
  it("does not expose Supabase error or exception details", () => {
    const message = getSignInErrorMessage();
    expect(message).not.toContain("Supabase");
    expect(message).not.toContain("stack");
  });
});

describe("Google OAuth initiation route", () => {
  beforeEach(() => {
    signInWithOAuthMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
  });

  it("redirects a safe request to the provider URL", async () => {
    signInWithOAuthMock.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
      error: null,
    });

    const response = await startGoogleOAuth(
      new Request(
        "http://127.0.0.1:3000/auth/google?next=%2Fprototype%2Fdesktop",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo:
          "http://127.0.0.1:3000/auth/callback?next=%2Fprototype%2Fdesktop",
      },
    });
  });

  it("normalizes an unsafe next before calling Supabase", async () => {
    signInWithOAuthMock.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
      error: null,
    });

    await startGoogleOAuth(
      new Request(
        "http://127.0.0.1:3000/auth/google?next=https%3A%2F%2Fevil.example",
      ),
    );

    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo:
          "http://127.0.0.1:3000/auth/callback?next=%2Fprototype%2Fdesktop",
      },
    });
  });

  it.each([
    { data: { url: "" }, error: { message: "provider failed" } },
    { data: { url: "" }, error: null },
  ])("returns a safe sign-in error when initiation fails", async (result) => {
    signInWithOAuthMock.mockResolvedValue(result);

    const response = await startGoogleOAuth(
      new Request("http://127.0.0.1:3000/auth/google"),
    );
    const location = response.headers.get("location") ?? "";

    expect(response.status).toBe(307);
    expect(location).toBe(
      "http://127.0.0.1:3000/sign-in?error=oauth&next=%2Fprototype%2Fdesktop",
    );
    expect(location).not.toContain("provider failed");
  });
});

describe("Google OAuth callback route", () => {
  it("preserves the requested desktop path after code exchange", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    const response = await finishGoogleOAuth(
      new Request(
        "http://127.0.0.1:3000/auth/callback?code=test-code&next=%2Fprototype%2Fdesktop",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/prototype/desktop",
    );
  });

  it.each([
    "http://127.0.0.1:3000/auth/callback?code=test-code",
    "http://127.0.0.1:3000/auth/callback?code=test-code&next=https%3A%2F%2Fevil.example",
    "http://127.0.0.1:3000/auth/callback?code=test-code&next=%2F%2Fevil.example",
  ])("falls back to desktop for an absent or unsafe next: %s", async (url) => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    const response = await finishGoogleOAuth(new Request(url));

    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/prototype/desktop",
    );
  });

  it("keeps the safe next on an OAuth exchange error", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: { message: "exchange failed" },
    });

    const response = await finishGoogleOAuth(
      new Request(
        "http://127.0.0.1:3000/auth/callback?code=test-code&next=%2Fprototype%2Fdesktop",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/sign-in?error=oauth&next=%2Fprototype%2Fdesktop",
    );
  });
});
