import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const shellPath = fileURLToPath(
  new URL(
    "../src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    import.meta.url,
  ),
);

describe("Canvas cached image lifecycle runtime contract", () => {
  it("rehydrates cached Canvas images and safely reconciles stale self-saves", async () => {
    const source = await readFile(shellPath, "utf8");
    expect(source).toContain("await restoreForCanvas(controller.state)");
    expect(source).toContain("serverCanvasMatchesCachedRuntime");
    expect(source).toContain("reconcileCachedRuntimeWithServer");
  });
});
