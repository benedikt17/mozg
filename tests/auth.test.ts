import { describe, expect, it } from "vitest";
import {
  getSafeRedirectPath,
  getSignInErrorMessage,
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
});

describe("getSignInErrorMessage", () => {
  it("does not expose Supabase error or exception details", () => {
    const message = getSignInErrorMessage();
    expect(message).not.toContain("Supabase");
    expect(message).not.toContain("stack");
  });
});
