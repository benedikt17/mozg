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

describe("Knowledge article action menu contract", () => {
  it("uses the shared folder menu primitive for folders, articles, and Trash", () => {
    expect(sidebarSource).toContain("function KnowledgeTreeActionMenu");
    expect(sidebarSource).toContain('kind="folder"');
    expect(sidebarSource).toContain('kind="document"');
    expect(sidebarSource).toContain('kind="trash-document"');
    expect(sidebarSource).toContain('className="knowledge-folder-menu"');
  });

  it("exposes article actions without adding rename or permanent delete", () => {
    expect(sidebarSource).toContain("Действия статьи");
    expect(sidebarSource).toContain("soft-delete-knowledge-document");
    expect(sidebarSource).toContain("Восстановить");
    expect(sidebarSource).not.toContain("Удалить навсегда");
    expect(sidebarSource).not.toContain("permanent-delete");
    expect(sidebarSource).not.toContain("rename-knowledge-document");
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
