import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = path.resolve(process.cwd(), ".github/workflows/ci.yml");
const lineageWorkflowPath = path.resolve(
  process.cwd(),
  ".github/workflows/production-lineage.yml",
);

function readWorkflow(): string {
  return fs.readFileSync(workflowPath, "utf8");
}

function readLineageWorkflow(): string {
  return fs.readFileSync(lineageWorkflowPath, "utf8");
}

describe("Production CI release gate", () => {
  it("runs on pull requests and exact Production branch pushes", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("refactor/prototype-state-root");
  });

  it("keeps changed-range formatting and whitespace checks mandatory", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("DIFF_BASE_SHA");
    expect(workflow).toContain("prettier --check");
    expect(workflow).toContain("git diff --check");
    expect(workflow).toContain("PR_BASE_SHA");
    expect(workflow).toContain("PUSH_BEFORE_SHA");
  });

  it("rejects candidates that do not contain the current Production branch", () => {
    const workflow = readLineageWorkflow();

    expect(workflow).toContain("Production Lineage Guard");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("refactor/prototype-state-root");
    expect(workflow).toContain("github.event.pull_request.head.sha");
    expect(workflow).toContain("git merge-base --is-ancestor");
    expect(workflow).toContain("Rebase or recreate the branch");
  });
});
