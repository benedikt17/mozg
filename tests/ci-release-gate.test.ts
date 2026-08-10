import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = path.resolve(process.cwd(), ".github/workflows/ci.yml");

function readWorkflow(): string {
  return fs.readFileSync(workflowPath, "utf8");
}

describe("Production CI release gate", () => {
  it("runs on pull requests and exact Production branch pushes", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("refactor/prototype-state-root");
  });

  it("keeps formatting and changed-range whitespace checks mandatory", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("pnpm format:check");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("git diff --check");
    expect(workflow).toContain("PR_BASE_SHA");
    expect(workflow).toContain("PUSH_BEFORE_SHA");
  });
});
