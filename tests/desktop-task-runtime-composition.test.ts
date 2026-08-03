import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const source=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
describe("desktop task runtime composition",()=>{it("mounts C2 Canvas boundaries",()=>{expect(source("src/prototype/desktop-shell.tsx")).toContain("DesktopCanvasWorkspace");expect(source("src/prototype/canvases/cloud-canvas-workspace.tsx")).toContain("CloudCanvasShellRepository");expect(source("src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell-page.tsx")).toContain("createLocalInfiniteCanvasRepository");});});


it("keeps Canvas bootstrap one-shot when active Canvas callbacks change", () => {
  const canvasShell = source("src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx");
  expect(canvasShell).toContain("const openCanvasRef = useRef(openCanvas);");
  expect(canvasShell).toContain("await openCanvasRef.current(cachedSummary.id);");
  expect(canvasShell).toContain("if (items[0]) await openCanvasRef.current(items[0].id);");
});


describe("C4 desktop Canvas toolbar", () => {
  it("keeps toolbar and task picker composition on the embedded shell", () => {
    const shell = source("src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx");
    const toolbar = source("src/prototype/canvases/canvas-desktop-composition.tsx");
    expect(shell).toContain("CanvasDesktopToolbar");
    expect(shell).toContain("desktopCanvasMain");
    expect(toolbar).toContain("onSelectTask");
    expect(toolbar).toContain("onAddImage");
  });
});
