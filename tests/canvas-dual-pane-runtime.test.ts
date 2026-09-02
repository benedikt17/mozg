import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspacePath = path.resolve(
  process.cwd(),
  "src/prototype/canvases/cloud-canvas-workspace.tsx",
);
const shellPath = path.resolve(
  process.cwd(),
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
);
const shellStylesPath = path.resolve(
  process.cwd(),
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
);

describe("Canvas dual-pane runtime composition", () => {
  it("creates independent repository and runtime-cache boundaries per pane", () => {
    const source = fs.readFileSync(workspacePath, "utf8");

    expect(source).toContain(
      'projectRuntimeCache(workspaceId, projectId, "primary")',
    );
    expect(source).toContain(
      'projectRuntimeCache(workspaceId, projectId, "secondary")',
    );
    expect(source).toContain("const primaryRepository = createPaneRepository(");
    expect(source).toContain(
      "const secondaryRepository = createPaneRepository(",
    );
  });

  it("routes global clipboard handling through the active pane only", () => {
    const workspace = fs.readFileSync(workspacePath, "utf8");
    const shell = fs.readFileSync(shellPath, "utf8");

    expect(workspace).toContain(
      'clipboardActive={!splitViewActive || activePane === "primary"}',
    );
    expect(workspace).toContain('clipboardActive={activePane === "secondary"}');
    expect(shell).toContain("!clipboardActive ||");
  });

  it("allows the Delete shortcut in the active pane only", () => {
    const shell = fs.readFileSync(shellPath, "utf8");

    expect(
      shell.match(
        /deleteKeyCode=\{clipboardActive \? \["Backspace", "Delete"\] : null\}/gu,
      ),
    ).toHaveLength(2);
  });

  it("uses the shared sidebar to select a Canvas in the active pane", () => {
    const source = fs.readFileSync(workspacePath, "utf8");

    expect(source).toContain("resolveCanvasPaneSelection({");
    expect(source).toContain("onSidebarSelectCanvas={selectCanvasFromSidebar}");
    expect(source).toContain("sidebarActiveCanvasId={");
  });

  it("routes toolbar selection without opening one Canvas in both panes", () => {
    const workspace = fs.readFileSync(workspacePath, "utf8");
    const shell = fs.readFileSync(shellPath, "utf8");

    expect(workspace).toContain('selectCanvasInPane("primary", canvasId)');
    expect(workspace).toContain('selectCanvasInPane("secondary", canvasId)');
    expect(shell).toContain("if (onToolbarSelectCanvas)");
  });

  it("keeps the primary Canvas mounted at full pane height", () => {
    const styles = fs.readFileSync(shellStylesPath, "utf8");

    expect(styles).toMatch(
      /\.desktopCanvasPane\s*>\s*\.desktopCanvasMain\s*\{[^}]*height:\s*100%;/u,
    );
  });

  it("renders the MiniMap for the active pane only", () => {
    const shell = fs.readFileSync(shellPath, "utf8");

    expect(shell).toContain(
      "const showMiniMap = !splitViewActive || paneActive;",
    );
    expect(shell.match(/\{showMiniMap \? \(/gu)).toHaveLength(2);
  });

  it("restores split selection from project-scoped browser runtime state", () => {
    const workspace = fs.readFileSync(workspacePath, "utf8");

    expect(workspace).toContain("projectDualPaneRuntimeStates");
    expect(workspace).toContain("getProjectDualPaneRuntimeState(");
    expect(workspace).toContain("setProjectDualPaneRuntimeState(");
    expect(workspace).toContain("setSplitViewActive(restored.splitViewActive)");
    expect(workspace).toContain("setPrimaryCanvasId(restored.primaryCanvasId)");
    expect(workspace).toContain(
      "setSecondaryCanvasId(restored.secondaryCanvasId)",
    );
    expect(workspace).toContain("const [dualPaneRuntimeReady");
    expect(workspace).toContain("if (!dualPaneRuntimeReady)");
    expect(workspace).toContain("setDualPaneRuntimeReady(true)");
  });

  it("flushes the latest viewport into the pane cache during navigation", () => {
    const shell = fs.readFileSync(shellPath, "utf8");

    expect(shell).toContain("const latestViewport = latestViewportRef.current");
    expect(shell).toContain("void controller.saveViewport(latestViewport)");
  });

  it("reveals a restored pane only after its saved viewport is applied", () => {
    const shell = fs.readFileSync(shellPath, "utf8");

    expect(shell).toContain(
      "const [viewportVisible, setViewportVisible] = useState(false)",
    );
    expect(shell).toContain("const applied = await reactFlow.setViewport(");
    expect(shell).toContain("setViewportVisible(true)");
  });
});
