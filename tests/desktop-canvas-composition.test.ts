import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("desktop Canvas composition", () => {
  it("uses the shared embedded shell and the persistent grouped sidebar", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    const sidebar = source("src/prototype/canvases/canvas-groups-sidebar.tsx");

    expect(shell).toContain("<CanvasDesktopSidebar");
    expect(shell).toContain("groups={groups}");
    expect(shell).toContain("onCreateGroup=");
    expect(shell).toContain("onMoveCanvas=");
    expect(shell).toContain("<CanvasDesktopToolbar");
    expect(shell).toContain("styles.desktopCanvasPage");
    expect(sidebar).toContain('aria-label="Дерево холстов"');
    expect(sidebar).toContain("styles.canvasTreeRow");
    expect(sidebar).toContain("styles.canvasTreeSelect");
    expect(sidebar).toContain('name="folder-plus"');
    expect(sidebar).toContain("onMoveGroup");
    expect(sidebar).toContain("onDeleteGroup");
    expect(sidebar).toContain("styles.canvasTreeChildren");
    expect(sidebar).toContain("groupDragType");
    expect(sidebar).toContain("Переименовать");
    expect(sidebar).toContain("Новая группа");
    expect(sidebar).not.toContain("knowledge-sidebar");
    expect(sidebar).not.toContain("knowledge-tree");
    expect(shell).toContain("desktopCanvasPageSidebarCollapsed");
    expect(shell).toContain("onToggleSidebar");
  });

  it("keeps the isolated route independent from the desktop composition", () => {
    const localRoute = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell-page.tsx",
    );
    const cloudWorkspace = source(
      "src/prototype/canvases/cloud-canvas-workspace.tsx",
    );
    expect(cloudWorkspace).toContain("embedded");
    expect(localRoute).not.toContain("embedded");
    expect(localRoute).toContain("showDiagnostics");
  });

  it("keeps image and PDF ingestion on the embedded viewport boundary", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    const toolbar = source(
      "src/prototype/canvases/canvas-desktop-composition.tsx",
    );
    expect(toolbar).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(toolbar).toContain("multiple");
    expect(toolbar).toContain("onAddImage(files)");
    expect(shell).toContain("attachCanvasImagePasteListener(onPaste)");
    expect(shell).toContain("const onDrop = useCallback");
    expect(shell).toContain("const payload = transferPayload(event.nativeEvent)");
    expect(shell).toContain("partitionCanvasDropFiles(payload.files)");
    expect(shell).toContain("runCanvasMixedDrop(");
    expect(shell).toContain('void ingest(payload, "drop", client)');
    expect(shell).toMatch(
      /ingest\(\s*\{ files, items: \[\], types: files\.map\(\(file\) => file\.type\) \},/,
    );
    expect(shell).toContain("onAddImage={(files) =>");
  });

  it("keeps task picker outside the clipped toolbar boundary", () => {
    const toolbar = source(
      "src/prototype/canvases/canvas-desktop-composition.tsx",
    );
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    expect(toolbar).toContain("createPortal(");
    expect(toolbar).toContain("taskPickerPanelRef");
    expect(toolbar).toContain('window.addEventListener("pointerdown"');
    expect(shell).toContain("const transientNodes = applyNodeChanges(");
    expect(shell).toContain("canvasDocumentToEdges(");
    expect(shell).toContain("canonical.filter((edge) => !known.has(edge.id))");
  });

  it("uses one centered fixed-size trigger primitive for Canvas and group rows", () => {
    const sidebar = source("src/prototype/canvases/canvas-groups-sidebar.tsx");
    const styles = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
    );

    expect(sidebar).toContain("className={styles.canvasTreeMenuTrigger}");
    expect(sidebar).toContain("data-canvas-menu-trigger={menuId}");
    expect(styles).toContain("display: inline-flex;");
    expect(styles).toContain("align-items: center;");
    expect(styles).toContain("justify-content: center;");
    expect(styles).toContain("font-size: 0;");
    expect(styles).toContain("line-height: 0;");
    expect(styles).toContain("display: block;");
  });

  it("closes an open row menu on pointerdown outside", () => {
    const sidebar = source("src/prototype/canvases/canvas-groups-sidebar.tsx");

    expect(sidebar).toContain(
      'document.addEventListener("pointerdown", onPointerDown)',
    );
    expect(sidebar).toContain(
      'target.closest("[data-canvas-menu-trigger], [data-canvas-menu]")',
    );
    expect(sidebar).toContain("setOpenMenuId(null);");
  });

  it("keeps menu clicks inside the menu before action handlers run", () => {
    const sidebar = source("src/prototype/canvases/canvas-groups-sidebar.tsx");

    expect(sidebar).toContain(
      'target.closest("[data-canvas-menu-trigger], [data-canvas-menu]")',
    );
    expect(sidebar).toMatch(
      /target\.closest\("\[data-canvas-menu-trigger\], \[data-canvas-menu\]"\)[\s\S]*?\{\s*return;/,
    );
  });

  it("closes the row menu on Escape", () => {
    const sidebar = source("src/prototype/canvases/canvas-groups-sidebar.tsx");

    expect(sidebar).toContain(
      'if (event.key === "Escape") setOpenMenuId(null);',
    );
    expect(sidebar).toContain(
      'document.addEventListener("keydown", onKeyDown)',
    );
  });

  it("switches the active menu when another row trigger is clicked", () => {
    const sidebar = source("src/prototype/canvases/canvas-groups-sidebar.tsx");

    expect(sidebar).toContain("const menuId = `canvas:${canvas.id}`;");
    expect(sidebar).toContain("const menuId = `group:${group.id}`;");
    expect(sidebar).toContain(
      "onOpenMenu(openMenuId === menuId ? null : menuId)",
    );
  });

  it("cleans up document listeners when the sidebar unmounts or closes", () => {
    const sidebar = source("src/prototype/canvases/canvas-groups-sidebar.tsx");

    expect(sidebar).toContain(
      'document.removeEventListener("pointerdown", onPointerDown)',
    );
    expect(sidebar).toContain(
      'document.removeEventListener("keydown", onKeyDown)',
    );
  });
});
