import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

const shell = read("src/prototype/desktop-shell.tsx");
const header = read("src/prototype/shell/application-header.tsx");
const nav = read("src/prototype/shell/mobile-navigation.tsx");
const css = read("src/prototype/desktop-shell.css");
const canvas = read(
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
);
const canvasCss = read(
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
);

describe("mobile responsive shell", () => {
  it("keeps the desktop rail while replacing it with mobile bottom navigation below 768px", () => {
    expect(shell).toContain(
      "<SectionRail state={state} dispatch={dispatch} />",
    );
    expect(shell).toContain("<MobileNavigation");
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.project-rail \{[\s\S]*display: none;/,
    );
    expect(css).toMatch(/\.mobile-bottom-navigation \{[\s\S]*position: fixed;/);
  });

  it("provides four primary sections plus More with touch-sized mobile controls", () => {
    for (const label of ["Обзор", "Знания", "Задачи", "Холсты", "Ещё"]) {
      expect(nav).toContain(label);
    }
    expect(nav).toContain('type: "switch-section"');
    expect(css).toContain("min-height: 54px");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });

  it("moves section sidebars into a mobile drawer without changing desktop markup", () => {
    expect(header).toContain("mobile-tool-sidebar-trigger");
    expect(shell).toContain("is-mobile-tool-sidebar-open");
    expect(shell).toContain("mobile-tool-sidebar-backdrop");
    expect(css).toMatch(
      /\.section-workspace \.tool-sidebar \{[\s\S]*position: fixed;/,
    );
  });

  it("starts the Canvas sidebar collapsed on mobile and keeps its desktop state otherwise", () => {
    expect(canvas).toContain('window.matchMedia("(max-width: 767px)").matches');
    expect(canvasCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.desktopCanvasSidebar \{[\s\S]*position: absolute;/,
    );
    expect(canvasCss).toContain("width: min(88vw, 340px)");
  });
});
