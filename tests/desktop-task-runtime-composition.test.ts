import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const source=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
describe("desktop task runtime composition",()=>{it("mounts C2 Canvas boundaries",()=>{expect(source("src/prototype/desktop-shell.tsx")).toContain("DesktopCanvasWorkspace");expect(source("src/prototype/canvases/cloud-canvas-workspace.tsx")).toContain("CloudCanvasShellRepository");expect(source("src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell-page.tsx")).toContain("createLocalInfiniteCanvasRepository");});});
