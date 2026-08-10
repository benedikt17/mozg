import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getKnowledgeTree,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";

describe("Stage 5 whole-root work boundaries", () => {
  it("reuses the Knowledge tree for content-only document edits", () => {
    const state = structuredClone(initialDesktopPrototypeState);
    const firstTree = getKnowledgeTree(state);
    const documentIndex = state.documents.findIndex(
      (document) =>
        document.projectId === state.activeProjectId &&
        document.deletedAt === undefined,
    );
    expect(documentIndex).toBeGreaterThanOrEqual(0);

    const contentOnlyState = {
      ...state,
      documents: state.documents.map((document, index) =>
        index === documentIndex
          ? { ...document, content: [...document.content, "content-only change"] }
          : document,
      ),
    };

    expect(getKnowledgeTree(contentOnlyState)).toBe(firstTree);
  });

  it("invalidates the Knowledge tree when tree-visible metadata changes", () => {
    const state = structuredClone(initialDesktopPrototypeState);
    const firstTree = getKnowledgeTree(state);
    const documentIndex = state.documents.findIndex(
      (document) =>
        document.projectId === state.activeProjectId &&
        document.deletedAt === undefined,
    );
    expect(documentIndex).toBeGreaterThanOrEqual(0);

    const renamedState = {
      ...state,
      documents: state.documents.map((document, index) =>
        index === documentIndex
          ? { ...document, title: `${document.title} updated` }
          : document,
      ),
    };

    expect(getKnowledgeTree(renamedState)).not.toBe(firstTree);
  });

  it("loads Command Palette only on demand", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/prototype/desktop-shell.tsx"),
      "utf8",
    );

    expect(source).toContain('import dynamic from "next/dynamic"');
    expect(source).toContain("const CommandPalette = dynamic(");
    expect(source).not.toContain(
      'import { CommandPalette } from "@/prototype/shell/command-palette";',
    );
  });

  it("mounts the hidden print renderer only while the share menu is open", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/prototype/knowledge/knowledge-workspace.tsx"),
      "utf8",
    );

    expect(source).toContain("{currentDocument && shareMenuOpen ? (");
    expect(source).not.toContain("{currentDocument ? (\n        <article\n          className=\"knowledge-print-document\"");
  });

  it("does not bind persistence snapshot creation to the whole Desktop state object", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/prototype/persistence/use-desktop-persistence.ts",
      ),
      "utf8",
    );

    expect(source).not.toContain(
      "const snapshot = useMemo(() => createDesktopDomainSnapshot(state), [state]);",
    );
    for (const dependency of [
      "documents",
      "knowledgeFolders",
      "overviewDirections",
      "projects",
      "taskGroups",
      "taskLists",
      "tasks",
    ]) {
      expect(source).toContain(dependency);
    }
  });
});
