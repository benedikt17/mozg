import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getCommandResults,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";

describe("Desktop command search runtime boundary", () => {
  it("derives command results from searchable collections without global runtime state", () => {
    const { activeProjectId, projects, tasks, documents, inboxItems } =
      initialDesktopPrototypeState;

    const results = getCommandResults(
      { activeProjectId, projects, tasks, documents, inboxItems },
      "Лукоморье",
    );

    expect(results.some((result) => result.kind === "project")).toBe(true);
  });

  it("does not bind command result memoization to the whole Desktop state", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/prototype/desktop-shell.tsx"),
      "utf8",
    );

    expect(source).not.toContain("[state, commandQuery]");
    expect(source).toContain("activeProjectId,");
    expect(source).toContain("getCommandResults(");
  });
});
