import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeSource = readFileSync(
  "src/prototype/knowledge/knowledge-annotations-runtime.tsx",
  "utf8",
);

describe("Knowledge annotations runtime lifecycle", () => {
  it("observes document.body so the runtime survives desktop root replacement", () => {
    expect(runtimeSource).toContain("const root = window.document.body;");
    expect(runtimeSource).not.toContain(
      'querySelector<HTMLElement>(".desktop-prototype")',
    );
  });

  it("finds the active reading page without depending on the transient section class", () => {
    expect(runtimeSource).toContain(
      '".desktop-prototype .document-page.is-active-pane[data-document-id]"',
    );
    expect(runtimeSource).not.toContain(".desktop-prototype.knowledge-active");
  });

  it("captures selection events before workspace handlers can replace the selection", () => {
    expect(runtimeSource).toContain(
      'window.document.addEventListener("pointerup", onPointerUp, true);',
    );
    expect(runtimeSource).toContain(
      'window.document.addEventListener("keyup", onKeyUp, true);',
    );
  });

  it("reuses the existing annotation update path for explicit re-anchor", () => {
    expect(runtimeSource).toContain("beginReanchor");
    expect(runtimeSource).toContain("reanchorKnowledgeAnnotation");
    expect(runtimeSource).toContain(
      "updateKnowledgeAnnotation(updated, persistenceMode)",
    );
    expect(runtimeSource).toContain("Привязать");
  });
});
