import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("CanvasNodeFrame composition", () => {
  it("owns the shared interaction layers and future connection slot", () => {
    const frame = source(
      "src/prototype/infinite-canvas-local-shell/canvas-node-frame.tsx",
    );

    expect(frame).toContain("function SelectionLayer");
    expect(frame).toContain("function ResizeLayer");
    expect(frame).toContain("function ConnectionHandleLayer");
    expect(frame).toContain("id={handle.id}");
    expect(frame).toContain('type="source"');
    expect(frame).toContain("Position.Top");
    expect(frame).toContain("Position.Right");
    expect(frame).toContain("Position.Bottom");
    expect(frame).toContain("Position.Left");
    expect(frame).toContain("function NodeToolbarSlot");
    expect(frame).toContain("function NodeContextMenuSlot");
    expect(frame).toContain('data-canvas-node-frame="true"');
    expect(frame).toContain('data-slot="connections"');
    expect(frame).toContain('data-slot="toolbar"');
    expect(frame).toContain('data-slot="context-menu"');
    expect(frame).toContain("isVisible={selected}");
  });

  it("is the only interaction frame used by task, text, and image bodies", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );

    expect(shell).toContain("function ImageNodeBody");
    expect(shell).toContain("function TextNodeBody");
    expect(shell).toContain("function TaskNodeBody");
    expect(shell.match(/<CanvasNodeFrame/g)).toHaveLength(3);
    expect(shell).not.toContain("NodeResizer");
    expect(shell).toContain("CANVAS_IMAGE_NODE_TYPE]: ImageNodeBody");
    expect(shell).toContain("CANVAS_TEXT_NODE_TYPE]: TextNodeBody");
    expect(shell).toContain("CANVAS_TASK_NODE_TYPE]: TaskNodeBody");
    expect(shell).toContain("toggleSubtaskCompleted");
    expect(shell).toContain("closeTaskDetails");
    expect(shell).toContain("activateNode");
    expect(shell).toContain("reactFlow.setNodes");
    expect(shell).toContain("contentMinHeight");
    expect(shell).toContain("scrollHeight");
    expect(shell).toContain("onContentHeightChange");
    expect(shell).toContain("Открыть детали");
    expect(shell).toContain("Закрыть детали");
    expect(shell).toContain("nodrag nopan");
    expect(shell).toContain("nodrag nopan nowheel");
  });

  it("keeps domain body styles separate from frame layout styles", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    const styles = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
    );

    expect(styles).toContain(".nodeFrame");
    expect(styles).toContain(".nodeBody");
    expect(styles).toContain("box-sizing: border-box;");
    expect(styles).toContain("--node-visual-border");
    expect(styles).toContain(".imageNodeFrame .nodeBody");
    expect(styles).toMatch(
      /\.imageNodeFrame\s*\{\s*--node-visual-border:\s*0;/u,
    );
    expect(styles).toContain("inset: 0;");
    expect(styles).toContain("object-fit: contain;");
    expect(styles).toContain("background: transparent;");
    expect(styles).toContain(".imageNodeFrame");
    expect(styles).toContain(".textNodeFrame");
    expect(styles).toContain(".taskNodeFrame");
    expect(styles).toContain("--node-visual-radius: 0;");
    expect(styles).toContain('.connectionHandle[data-side="top"]');
    expect(styles).toContain('.connectionHandle[data-side="right"]');
    expect(styles).toContain('.connectionHandle[data-side="bottom"]');
    expect(styles).toContain('.connectionHandle[data-side="left"]');
    expect(styles).toContain(
      "top: calc(-1 * var(--connection-handle-center-offset));",
    );
    expect(styles).toContain(
      "left: calc(100% + var(--connection-handle-center-offset));",
    );
    expect(styles).toContain(
      "top: calc(100% + var(--connection-handle-center-offset));",
    );
    expect(styles).toContain(
      "left: calc(-1 * var(--connection-handle-center-offset));",
    );
    expect(styles).toContain("right: auto;");
    expect(styles).toContain("bottom: auto;");
    expect(styles).toContain("transform: translate(-50%, -50%);");
    expect(styles).not.toContain("transform: scale");
    expect(shell).not.toContain("styles.caption");
    expect(shell).toContain("EdgeToolbar");
    expect(shell).toContain("connectionLineComponent={CanvasConnectionLine}");
    expect(shell).toContain("markerStart={markerStart}");
    expect(shell).toContain("markerEnd={markerEnd}");
    expect(shell).toContain("data-source-node-id={source}");
    expect(shell).toContain("data-target-node-id={target}");
    expect(shell).toContain("path={lastPath}");
    expect(shell).toContain("canvasNodePerimeterAnchor");
    expect(shell).not.toContain("canvasEdgePerimeterAnchors");
    expect(shell).not.toContain("CANVAS_CONNECTION_HANDLE_EDGE_OFFSET");
    expect(shell).toContain("findShortestCanvasHandlePair");
    expect(shell).toContain("recomputeCanvasRuntimeEdgeHandles");
    expect(shell).toContain("controller.setRuntimeNodes");
    expect(shell).toContain("controller.setRuntimeEdges(edgesRef.current)");
    expect(styles).toContain("--connection-handle-center-offset");
    expect(styles).toContain(".taskNodeContent");
    expect(styles).toContain(".textNodeContent");
    const sidebarListRule =
      styles.match(/\.desktopCanvasSidebarList\s*\{([^}]*)\}/u)?.[1] ?? "";
    expect(sidebarListRule).toContain("overflow-x: hidden");
    expect(sidebarListRule).toContain("overflow-y: auto");
    const canvasRule = styles.match(/\.canvas\s*\{([^}]*)\}/u)?.[1] ?? "";
    expect(canvasRule).not.toContain("overflow-y");
    expect(canvasRule).not.toContain("overflow: scroll");
    expect(styles).toContain(":global(.cloud-canvas-session-shell)");
  });

  it("keeps edge-handle projection live during transient node drags", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );

    expect(shell).toContain("recomputeCanvasRuntimeEdgeHandles(");
    expect(shell).toContain("controller.setRuntimeNodes(");
    expect(shell).toContain("controller.setRuntimeEdges(edgesRef.current)");
  });
});
