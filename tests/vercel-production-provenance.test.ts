import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = path.resolve(
  process.cwd(),
  "scripts/verify-vercel-production-provenance.mjs",
);

function runProvenanceCheck(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "",
      VERCEL_GIT_COMMIT_SHA: "",
      ...environment,
    },
  });
}

describe("Vercel Production provenance guard", () => {
  it("does not restrict local or Preview builds", () => {
    const result = runProvenanceCheck({ VERCEL_ENV: "preview" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("accepts a Git-backed build from the exact Production branch", () => {
    const result = runProvenanceCheck({
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "refactor/prototype-state-root",
      VERCEL_GIT_COMMIT_SHA: "c12357969498ec3b24fe2e3733095a47c255576e",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Production provenance verified");
  });

  it("rejects a Production build without Git metadata", () => {
    const result = runProvenanceCheck({ VERCEL_ENV: "production" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Git metadata is missing");
  });

  it("rejects a Production build from a feature branch", () => {
    const result = runProvenanceCheck({
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "feature/stale-canvas",
      VERCEL_GIT_COMMIT_SHA: "c12357969498ec3b24fe2e3733095a47c255576e",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("is not the Production branch");
  });
});
