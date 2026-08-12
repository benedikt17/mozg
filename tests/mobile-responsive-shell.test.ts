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
const overview = read("src/prototype/overview/overview-workspace.tsx");
const overviewDirection = read(
  "src/prototype/overview/overview-direction-column.tsx",
);
const overviewReader = read(
  "src/prototype/overview/overview-contextual-reader.tsx",
);
const overviewSection = read(
  "src/prototype/overview/overview-section-workspace.tsx",
);
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

  it("uses one sticky mobile drawer trigger for Overview details, Knowledge, Tasks and Canvas", () => {
    expect(header).toContain("mobile-tool-sidebar-trigger");
    expect(header).toContain("overviewArticleSourceTaskId");
    expect(header).toContain("mobileOverviewContextOpen");
    expect(header).toContain('state.activeSection === "canvases"');
    expect(header).toContain("Свернуть список холстов");
    expect(header).toContain("Развернуть список холстов");
    expect(header).toContain("onPointerDown={handleMobileDrawerPointerDown}");
    expect(header).toContain("suppressMobileDrawerClickRef");
    expect(shell).toContain("mobileOverviewContextOpen");
    expect(shell).toContain("is-mobile-tool-sidebar-open");
    expect(shell).toContain("mobile-tool-sidebar-backdrop");
    expect(css).toMatch(
      /\.section-workspace \.tool-sidebar \{[\s\S]*position: fixed;/,
    );
    expect(mobileCss).toContain(":global(.mobile-tool-sidebar-trigger)");
    expect(mobileCss).toContain("position: fixed");
    expect(mobileCss).toContain("border-radius: 999px");
    expect(mobileCss).toContain("touch-action: manipulation");
    expect(mobileCss).toContain(
      ':global(.section-canvases aside[aria-label="Дерево холстов"])',
    );
  });

  it("keeps mobile menu lifecycle out of synchronous effects", () => {
    expect(shell).not.toContain(
      "useEffect(() => {\n    setMobileToolSidebarOpen(false);",
    );
    expect(nav).not.toContain("useEffect(() => {\n    setMoreOpen(false);");
  });

  it("starts the Canvas sidebar collapsed, changes the header icon to close and blocks the exposed canvas gap", () => {
    expect(canvas).toContain('window.matchMedia("(max-width: 767px)").matches');
    expect(canvas).toContain("window.requestAnimationFrame");
    expect(canvasCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.desktopCanvasSidebar \{[\s\S]*position: absolute;/,
    );
    expect(canvasCss).toContain("width: min(88vw, 340px)");
    expect(header).toContain("canvasDrawerOpen");
    expect(header).toContain('mobileDrawerOpen ? "close" : "panel-left"');
    expect(header).toContain("mobile-canvas-drawer-backdrop");
    expect(header).toContain("closeCanvasDrawer");
    expect(mobileCss).toContain(":global(.mobile-canvas-drawer-backdrop)");
    expect(mobileCss).toContain("left: min(88vw, 340px)");
    expect(mobileCss).toContain("z-index: 75");
    expect(mobileCss).toContain("position: fixed !important");
    expect(mobileCss).toContain("left: 0 !important");
    expect(mobileCss).toContain('[aria-label="Свернуть список холстов"]');
  });

  it("auto-hides Knowledge action chrome smoothly without moving the persistent mobile header", () => {
    expect(nav).toContain("data-mobile-reading-chrome");
    expect(nav).toContain('target.classList.contains("document-page")');
    expect(nav).toContain("state.editingKnowledgeDocumentId !== null");
    expect(nav).toContain("maxScrollTop");
    expect(nav).toContain("directionDistance >= 24");
    expect(nav).toContain("directionDistance >= 14");
    expect(mobileCss).toContain("height: 0");
    expect(mobileCss).toContain("max-height: 0");
    expect(mobileCss).toContain("opacity: 0");
    expect(mobileCss).toContain("height 180ms ease");
    expect(mobileCss).toContain("padding-top 180ms ease");
    expect(mobileCss).not.toContain("--header-height: 0px");
    expect(mobileCss).toContain("overscroll-behavior-y: contain");
    expect(mobileCss).toContain("-webkit-overflow-scrolling: touch");
  });

  it("keeps project and active Knowledge article titles stable in the mobile header", () => {
    expect(header).toContain("getKnowledgePaneState");
    expect(header).toContain("application-article-title");
    expect(mobileCss).toContain(":global(.application-article-title)");
    expect(mobileCss).toContain("text-overflow: ellipsis");
    expect(mobileCss).toContain("max-width: 48%");
  });

  it("removes duplicate mobile Knowledge close/tab/breadcrumb chrome while preserving the action row", () => {
    expect(mobileCss).toContain(":global(.section-knowledge .document-tabs)");
    expect(mobileCss).toContain(
      ":global(.section-knowledge .document-breadcrumb-row)",
    );
    expect(mobileCss).toContain(
      ":global(.section-knowledge .knowledge-responsive-actions)",
    );
    expect(mobileCss).toContain(
      ":global(.section-knowledge .knowledge-responsive-close)",
    );
    expect(mobileCss).toContain(
      ":global(.section-knowledge .document-tabs-row > .document-actions)",
    );
  });

  it("keeps Overview details focus-safe and routes the phone context drawer through the header", () => {
    expect(overviewSection).toContain("inert={readerActive}");
    expect(overviewSection).not.toContain("aria-hidden={readerActive}");
    expect(overviewSection).toContain("mobileContextOpen={mobileContextOpen}");
    expect(overviewReader).toContain("onMobileContextOpenChange");
    expect(overviewReader).toContain(
      'window.matchMedia("(max-width: 767px)").matches',
    );
    expect(mobileCss).toContain(
      ":global(.section-overview .task-details-toolbar-spacer)",
    );
    expect(mobileCss).toContain(
      ".task-details-workspace-toolbar\n      .document-actions\n      > button:first-child",
    );
    expect(mobileCss).toContain(
      ":global(.section-overview .overview-reader-mobile-close)",
    );
    expect(mobileCss).toContain(
      ".section-overview .overview-reader-mobile-actions > button:first-child",
    );
  });

  it("aligns expanded Overview cards and tapped columns without fighting native scroll inertia", () => {
    expect(overview).toContain(
      'window.matchMedia("(max-width: 767px)").matches',
    );
    expect(overview).toContain(
      'details?.closest<HTMLElement>(".board-column")',
    );
    expect(overview).toContain(
      "board.scrollLeft + columnRect.left - boardRect.left",
    );
    expect(overview).toContain("mobileAlignmentInProgressRef");
    expect(overview).toContain("mobileAlignmentTimerRef");
    expect(overview).toContain("mobileGestureSettleTimerRef");
    expect(overview).toContain("onActivateColumn={alignMobileColumn}");
    expect(overview).toContain('behavior: "smooth"');
    expect(overview).toContain(
      "if (mobileAlignmentInProgressRef.current) return",
    );
    expect(overviewDirection).toContain(
      "onActivateColumn?.(event.currentTarget)",
    );
    expect(mobileCss).toContain("scroll-snap-type: x mandatory");
    expect(mobileCss).toContain("scroll-snap-align: start");
    expect(mobileCss).toContain("scroll-snap-stop: always");
  });

  it("keeps mobile document and Canvas action rows left-anchored and horizontally scrollable", () => {
    expect(mobileCss).toContain(
      ":global(.document-tabs-row > .document-actions)",
    );
    expect(mobileCss).toContain("justify-content: flex-start");
    expect(mobileCss).toContain("overflow-x: auto");
  });

  it("removes nonessential Canvas success chrome and phone-only helper controls", () => {
    expect(mobileCss).toContain(
      ":global(.desktop-persistence-status:not(.is-error))",
    );
    expect(mobileCss).toContain(".react-flow__controls");
    expect(mobileCss).toContain('[class*="canvasHint"]');
    expect(mobileCss).toContain("grid-template-rows: 38px");
    expect(mobileCss).toContain("height: 38px");
    expect(mobileCss).toContain('[aria-live="polite"]:has(button)');
  });
});
