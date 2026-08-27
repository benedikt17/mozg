import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("Canvas cached-remount projection", () => {
  it("restores every supported node kind when returning to the Canvas section", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    const runtimeSkeleton = source(
      "src/lib/canvas/canvas-runtime-skeleton.ts",
    );
    const restoreStart = shell.indexOf(
      "const restoreCachedScene = useCallback(",
    );
    const restoreEnd = shell.indexOf("\n  useEffect(", restoreStart);

    expect(restoreStart).toBeGreaterThanOrEqual(0);
    expect(restoreEnd).toBeGreaterThan(restoreStart);

    const restoreCachedScene = shell.slice(restoreStart, restoreEnd);
    expect(restoreCachedScene).toContain(
      "canvasDocumentToRuntimeSkeleton(cachedState.document",
    );
    expect(runtimeSkeleton).toContain("...canvasDocumentToShapeNodes(document),");
    expect(runtimeSkeleton).toContain("...canvasDocumentToPdfNodes(document),");
  });
});
