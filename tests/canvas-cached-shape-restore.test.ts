import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shellSource = (): string =>
  readFileSync(
    new URL(
      "../src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
      import.meta.url,
    ),
    "utf8",
  );

describe("Canvas cached-remount projection", () => {
  it("restores shape nodes when returning to the Canvas section", () => {
    const shell = shellSource();
    const restoreStart = shell.indexOf("const restoreCachedScene = useCallback(");
    const restoreEnd = shell.indexOf("\n  useEffect(() => {", restoreStart);

    expect(restoreStart).toBeGreaterThanOrEqual(0);
    expect(restoreEnd).toBeGreaterThan(restoreStart);

    const restoreCachedScene = shell.slice(restoreStart, restoreEnd);
    expect(restoreCachedScene).toContain(
      "...canvasDocumentToShapeNodes(cachedState.document),",
    );
  });
});
