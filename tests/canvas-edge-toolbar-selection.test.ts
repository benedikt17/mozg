import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL(
    "../src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("Canvas edge toolbar selection", () => {
  it("shows an edge toolbar only for the sole selected edge", () => {
    expect(source).toContain(
      "state.edges.filter((edge) => edge.selected).length",
    );
    expect(source).toContain(
      "state.nodes.filter((node) => node.selected).length",
    );
    expect(source).toContain(
      "const toolbarVisible = selected && selectedElementCount === 1;",
    );
    expect(source).toContain("{toolbarVisible ? (");
    expect(source).toContain("isVisible={toolbarVisible}");
  });
});
