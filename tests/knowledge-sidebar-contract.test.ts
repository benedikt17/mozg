import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sidebarSource = readFileSync(
  resolve(process.cwd(), "src/prototype/knowledge/knowledge-sidebar.tsx"),
  "utf8",
);
const sidebarStyles = readFileSync(
  resolve(process.cwd(), "src/prototype/desktop-knowledge.css"),
  "utf8",
);
const trashViewSource = readFileSync(
  resolve(process.cwd(), "src/prototype/knowledge/knowledge-trash-view.tsx"),
  "utf8",
);

describe("Knowledge article action menu contract", () => {
  it("uses the shared folder menu primitive for folders, articles, and Trash", () => {
    expect(sidebarSource).toContain("function KnowledgeTreeActionMenu");
    expect(sidebarSource).toContain('kind="folder"');
    expect(sidebarSource).toContain('kind="document"');
    expect(trashViewSource).toContain('kind="trash-document"');
    expect(sidebarSource).toContain('className="knowledge-folder-menu"');
  });

  it("keeps normal article actions separate from Trash actions", () => {
    expect(sidebarSource).toContain("Действия статьи");
    expect(sidebarSource).toContain("soft-delete-knowledge-document");
    expect(sidebarSource).toContain("Восстановить");
    expect(trashViewSource).toContain("KnowledgeTreeActionMenu");
    expect(trashViewSource).toContain("Удалить навсегда");
    expect(trashViewSource).toContain("permanently-delete-knowledge-document");
    expect(sidebarSource).not.toContain("rename-knowledge-document");
  });

  it("renders Trash as a fixed footer outside the scrollable tree", () => {
    expect(sidebarSource).toContain('className="knowledge-tree"');
    expect(sidebarSource).toContain('className="knowledge-sidebar-footer"');
    expect(sidebarSource).toContain(
      'onClick={() => dispatch({ type: "open-knowledge-trash" })}',
    );
    expect(sidebarSource).not.toContain("knowledge-trash-section");
    expect(sidebarStyles).toContain(
      "grid-template-rows: auto auto minmax(0, 1fr) auto",
    );
    expect(sidebarStyles).toContain(".knowledge-sidebar-footer");
  });

  it("keeps Trash flat and gives it its own scrollable main view", () => {
    expect(trashViewSource).toContain('className="knowledge-trash-view"');
    expect(trashViewSource).toContain('className="knowledge-trash-list"');
    expect(trashViewSource).toContain("getKnowledgeTrashDocuments(state)");
    expect(trashViewSource).toContain("Корзина пуста");
    expect(sidebarSource).not.toContain("KnowledgeTrashDocumentRow");
  });

  it("keeps the action outside the draggable article button and reserves the folder row geometry", () => {
    expect(sidebarSource).toContain(
      "onPointerDown={(event) => event.stopPropagation()}",
    );
    expect(sidebarSource).toContain("onClick={(event) => {");
    expect(sidebarStyles).toContain(".knowledge-action-row");
    expect(sidebarStyles).toContain("var(--sidebar-trailing-slot)");
    expect(sidebarStyles).toContain("text-overflow: ellipsis");
  });
});
