import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("Next development configuration", () => {
  it("allows the canonical local Desktop origin to load development resources", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });
});
