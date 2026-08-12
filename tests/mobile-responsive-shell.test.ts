import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Contract: mobile rules must coexist with the accepted desktop shell.
const read = (file: string) =>
  fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

const shell = read("src/prototype/desktop-shell.tsx");
const header = read("src/prototype/shell/application-header.tsx");
const nav = read("src/prototype/shell/mobile-navigation.tsx");
const mobileCss = read("src/prototype/shell/mobile-navigation.module.css");
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

  it("keeps mobile menu lifecycle out of synchronous effects", () => {
    expect(shell).not.toContain(
      "useEffect(() => {\n    setMobileToolSidebarOpen(false);",
    );
    expect(nav).not.toContain("useEffect(() => {\n    setMoreOpen(false);");
  });

  it("starts the Canvas sidebar collapsed on mobile and keeps its desktop state otherwise", () => {
    expect(canvas).toContain('window.matchMedia("(max-width: 767px)").matches');
    expect(canvas).toContain("window.requestAnimationFrame");
    expect(canvasCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.desktopCanvasSidebar \{[\s\S]*position: absolute;/,
    );
    expect(canvasCss).toContain("width: min(88vw, 340px)");
  });

  it("auto-hides Knowledge chrome while reading and restores it when scrolling back", () => {
    expect(nav).toContain("data-mobile-reading-chrome");
    expect(nav).toContain('target.classList.contains("document-page")');
    expect(nav).toContain("state.editingKnowledgeDocumentId !== null");
    expect(nav).toContain("directionDistance >= 24");
    expect(nav).toContain("directionDistance >= 14");
    expect(mobileCss).toContain(
      ':global([data-mobile-reading-chrome="hidden"] .application-header)',
    );
    expect(mobileCss).toContain(
      ':global([data-mobile-reading-chrome="hidden"] .document-tabs-row)',
    );
    expect(mobileCss).toContain(
      ':global([data-mobile-reading-chrome="hidden"] .document-breadcrumb-row)',
    );
    expect(mobileCss).toContain(".document-page:not(.is-editing)");
  });

  it("keeps mobile document and Canvas action rows left-anchored and horizontally scrollable", () => {
    expect(mobileCss).toContain(
      ":global(.document-tabs-row > .document-actions)",
    );
    expect(mobileCss).toContain("justify-content: flex-start");
    expect(mobileCss).toContain("overflow-x: auto");
  });
});
