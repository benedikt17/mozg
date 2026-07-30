import { describe, expect, it } from "vitest";
import { shouldShowAuthenticatedAccountControls } from "@/lib/desktop-runtime-mode";
import { resolveLocalDevelopmentMode } from "@/lib/local-development-mode";

describe("resolveLocalDevelopmentMode", () => {
  it.each([
    [{ nodeEnv: "development", localDevModeValue: "true" }, true],
    [{ nodeEnv: "development", localDevModeValue: "false" }, false],
    [{ nodeEnv: "development", localDevModeValue: undefined }, false],
    [{ nodeEnv: "production", localDevModeValue: "true" }, false],
    [{ nodeEnv: "production", localDevModeValue: undefined }, false],
    [{ nodeEnv: "development", localDevModeValue: "TRUE" }, false],
    [{ nodeEnv: "development", localDevModeValue: " true" }, false],
  ] as const)("resolves %o as %s", (input, expected) => {
    expect(resolveLocalDevelopmentMode(input)).toBe(expected);
  });
});

describe("authenticated account controls", () => {
  it("remains available only in cloud mode", () => {
    expect(shouldShowAuthenticatedAccountControls("local")).toBe(false);
    expect(shouldShowAuthenticatedAccountControls("cloud")).toBe(true);
  });
});
