from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)


shell_path = Path("src/prototype/desktop-shell.tsx")
shell = shell_path.read_text()
shell = replace_once(
    shell,
    'import { SectionRail } from "@/prototype/shell/section-rail";\n',
    'import { SectionRail } from "@/prototype/shell/section-rail";\nimport { MobileNavigation } from "@/prototype/shell/mobile-navigation";\n',
    "mobile navigation import",
)
shell = replace_once(
    shell,
    "  const [activeCommandIndex, setActiveCommandIndex] = useState(0);\n",
    "  const [activeCommandIndex, setActiveCommandIndex] = useState(0);\n  const [mobileToolSidebarOpen, setMobileToolSidebarOpen] = useState(false);\n",
    "mobile sidebar state",
)
shell = replace_once(
    shell,
    "  useEffect(() => {\n    if (!workspaceAvailable) return;\n    if (isPublicProjectSection(state.activeSection)) return;\n",
    "  useEffect(() => {\n    setMobileToolSidebarOpen(false);\n  }, [state.activeProjectId, state.activeSection]);\n\n  useEffect(() => {\n    if (!workspaceAvailable) return;\n    if (isPublicProjectSection(state.activeSection)) return;\n",
    "mobile sidebar close effect",
)
shell = replace_once(
    shell,
    "        <ApplicationHeader\n          dispatch={dispatch}\n          runtimeMode={runtimeMode}\n          state={state}\n        />",
    "        <ApplicationHeader\n          dispatch={dispatch}\n          mobileToolSidebarOpen={mobileToolSidebarOpen}\n          onToggleMobileToolSidebar={() =>\n            setMobileToolSidebarOpen((open) => !open)\n          }\n          runtimeMode={runtimeMode}\n          state={state}\n        />",
    "application header mobile props",
)
shell = replace_once(
    shell,
    "        <SectionWorkspace\n          dispatch={dispatch}\n          state={state}\n          workspaceId={workspaceId}\n        />",
    "        <SectionWorkspace\n          dispatch={dispatch}\n          mobileToolSidebarOpen={mobileToolSidebarOpen}\n          onCloseMobileToolSidebar={() => setMobileToolSidebarOpen(false)}\n          state={state}\n          workspaceId={workspaceId}\n        />",
    "section workspace mobile props",
)
shell = replace_once(
    shell,
    "      </div>\n      <DesktopPersistenceStatus",
    "      </div>\n      <MobileNavigation\n        dispatch={dispatch}\n        runtimeMode={runtimeMode}\n        state={state}\n      />\n      <DesktopPersistenceStatus",
    "mobile navigation render",
)
shell = replace_once(
    shell,
    "function SectionWorkspace({\n  state,\n  dispatch,\n  workspaceId,\n}: {\n  state: DesktopPrototypeState;\n  dispatch: Dispatch;\n  workspaceId?: string;\n}): React.JSX.Element {",
    "function SectionWorkspace({\n  state,\n  dispatch,\n  workspaceId,\n  mobileToolSidebarOpen,\n  onCloseMobileToolSidebar,\n}: {\n  state: DesktopPrototypeState;\n  dispatch: Dispatch;\n  workspaceId?: string;\n  mobileToolSidebarOpen: boolean;\n  onCloseMobileToolSidebar: () => void;\n}): React.JSX.Element {",
    "section workspace signature",
)
shell = replace_once(
    shell,
    '        sidebar ? "has-tool-sidebar" : "",\n',
    '        sidebar ? "has-tool-sidebar" : "",\n        sidebar && mobileToolSidebarOpen ? "is-mobile-tool-sidebar-open" : "",\n',
    "mobile sidebar class",
)
shell = replace_once(
    shell,
    "      </TasksDndBoundary>\n      {state.activeSection === \"knowledge\" && knowledgeTreeOverlayOpen ? (",
    "      </TasksDndBoundary>\n      {sidebar && mobileToolSidebarOpen ? (\n        <button\n          aria-label=\"Закрыть панель раздела\"\n          className=\"mobile-tool-sidebar-backdrop\"\n          onClick={onCloseMobileToolSidebar}\n          type=\"button\"\n        />\n      ) : null}\n      {state.activeSection === \"knowledge\" && knowledgeTreeOverlayOpen ? (",
    "mobile sidebar backdrop",
)
shell_path.write_text(shell)

css_path = Path("src/prototype/desktop-shell.css")
css = css_path.read_text()
mobile_css = r'''

  /* Mobile shell is isolated below 768px so the accepted desktop layout stays untouched. */
  .mobile-bottom-navigation,
  .mobile-more-backdrop,
  .mobile-more-sheet,
  .mobile-tool-sidebar-trigger,
  .mobile-tool-sidebar-spacer,
  .mobile-tool-sidebar-backdrop {
    display: none;
  }

  @media (max-width: 767px) {
    :scope {
      --header-height: 52px;
      --mobile-nav-height: 60px;
      grid-template-columns: minmax(0, 1fr);
      overflow: hidden;
    }

    .project-rail {
      display: none;
    }

    .project-workspace {
      min-width: 0;
      width: 100%;
      height: 100dvh;
      grid-column: 1;
      grid-template-rows: var(--header-height) minmax(0, 1fr);
      padding-bottom: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom));
    }

    .application-header {
      grid-template-columns: minmax(0, 1fr) 44px;
      gap: 4px;
      min-height: var(--header-height);
      padding: 0 8px 0 12px;
    }

    .application-project-title {
      width: auto;
      min-width: 0;
      padding-inline: 0;
    }

    .application-project-title strong {
      font-size: 18px;
      line-height: 22px;
    }

    .application-section-navigation,
    .application-header-right {
      display: none;
    }

    .mobile-tool-sidebar-trigger,
    .mobile-tool-sidebar-spacer {
      grid-column: 2;
      grid-row: 1;
      align-self: center;
    }

    .mobile-tool-sidebar-trigger {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--text-2);
      padding: 0;
    }

    .mobile-tool-sidebar-trigger:active,
    .mobile-tool-sidebar-trigger[aria-expanded="true"] {
      background: var(--surface-selected);
      color: var(--text);
    }

    .mobile-tool-sidebar-trigger .ui-icon {
      width: 20px;
      height: 20px;
    }

    .mobile-tool-sidebar-spacer {
      display: block;
      width: 40px;
      height: 40px;
      pointer-events: none;
    }

    .section-workspace,
    .section-workspace.has-tool-sidebar,
    .section-workspace.has-context-panel,
    .section-workspace.has-tool-sidebar.has-context-panel,
    .section-workspace.has-full-height-drawer,
    .section-workspace.has-tool-sidebar.has-context-panel.has-full-height-drawer {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    .main-workspace {
      min-width: 0;
      width: 100%;
      overflow-x: hidden;
    }

    .section-workspace .tool-sidebar {
      position: fixed;
      top: var(--header-height);
      left: 0;
      bottom: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom));
      z-index: 56;
      width: min(88vw, 340px);
      height: auto;
      min-height: 0;
      overflow: hidden;
      border-right: 1px solid var(--border);
      border-bottom: 0;
      background: var(--surface-2);
      box-shadow: var(--shadow-overlay);
      transform: translateX(-104%);
      transition: transform 160ms ease;
    }

    .section-workspace.is-mobile-tool-sidebar-open .tool-sidebar,
    .section-workspace.is-knowledge-tree-open .tool-sidebar {
      transform: translateX(0);
    }

    .mobile-tool-sidebar-backdrop {
      position: fixed;
      inset: var(--header-height) 0 calc(var(--mobile-nav-height) + env(safe-area-inset-bottom));
      z-index: 55;
      display: block;
      border: 0;
      background: rgb(32 32 29 / 22%);
      padding: 0;
    }

    .context-panel {
      position: fixed;
      inset: var(--header-height) 0 calc(var(--mobile-nav-height) + env(safe-area-inset-bottom));
      z-index: 60;
      width: 100%;
      max-width: none;
      max-height: none;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }

    .desktop-persistence-status,
    .desktop-persistence-status.has-right-panel {
      right: 8px;
      bottom: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom) + 8px);
    }

    .mobile-bottom-navigation {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 80;
      height: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom));
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      align-items: start;
      border-top: 1px solid var(--border);
      background: color-mix(in srgb, var(--surface) 96%, transparent);
      padding: 3px 4px env(safe-area-inset-bottom);
      backdrop-filter: blur(18px);
    }

    .mobile-bottom-navigation-item {
      min-width: 0;
      min-height: 54px;
      display: grid;
      grid-template-rows: 25px 14px;
      place-items: center;
      gap: 1px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--text-3);
      padding: 5px 2px 3px;
      font: inherit;
    }

    .mobile-bottom-navigation-item .ui-icon {
      width: 21px;
      height: 21px;
    }

    .mobile-bottom-navigation-item span {
      max-width: 100%;
      overflow: hidden;
      font-size: 10px;
      line-height: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mobile-bottom-navigation-item[data-active="true"] {
      color: #ff5200;
      background: color-mix(in srgb, #ff5200 8%, transparent);
    }

    .mobile-more-backdrop {
      position: fixed;
      inset: 0 0 calc(var(--mobile-nav-height) + env(safe-area-inset-bottom));
      z-index: 70;
      display: block;
      border: 0;
      background: rgb(32 32 29 / 28%);
      padding: 0;
    }

    .mobile-more-sheet {
      position: fixed;
      left: 8px;
      right: 8px;
      bottom: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom) + 8px);
      z-index: 75;
      display: grid;
      gap: 14px;
      max-height: min(68dvh, 620px);
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--surface);
      padding: 14px;
      box-shadow: var(--shadow-overlay);
    }

    .mobile-more-sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .mobile-more-sheet-header > div {
      min-width: 0;
      display: grid;
      gap: 2px;
    }

    .mobile-more-sheet-header span,
    .mobile-more-label {
      color: var(--text-3);
      font-size: 11px;
      line-height: 14px;
      font-weight: 600;
    }

    .mobile-more-sheet-header strong {
      overflow: hidden;
      font-size: 18px;
      line-height: 22px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mobile-more-close {
      width: 40px;
      height: 40px;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 10px;
      background: var(--surface-hover);
      color: var(--text-2);
    }

    .mobile-more-close .ui-icon {
      width: 18px;
      height: 18px;
    }

    .mobile-more-section {
      display: grid;
      gap: 6px;
    }

    .mobile-project-list,
    .mobile-more-actions {
      display: grid;
      gap: 4px;
    }

    .mobile-project-option,
    .mobile-more-actions > button {
      width: 100%;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--text);
      padding: 8px 10px;
      font: inherit;
      font-size: 14px;
      text-align: left;
    }

    .mobile-project-option[data-active="true"] {
      background: var(--surface-selected);
      color: #ff5200;
      font-weight: 600;
    }

    .mobile-project-option .ui-icon,
    .mobile-more-actions .ui-icon {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
    }

    .mobile-more-actions > button {
      justify-content: flex-start;
    }

    .mobile-more-ai-icon,
    .mobile-more-signout-icon {
      width: 18px;
      flex: 0 0 18px;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 700;
      text-align: center;
    }

    .command-backdrop {
      padding: 12px;
      padding-top: calc(var(--header-height) + 10px);
    }

    .command-palette {
      width: 100%;
      max-height: calc(100dvh - var(--header-height) - var(--mobile-nav-height) - 32px);
    }
  }
'''
if "/* Mobile shell is isolated below 768px" in css:
    raise SystemExit("mobile shell CSS already applied")
last = css.rfind("}")
if last == -1:
    raise SystemExit("desktop-shell.css missing closing scope brace")
css_path.write_text(css[:last] + mobile_css + "\n" + css[last:])

canvas_path = Path("src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx")
canvas = canvas_path.read_text()
canvas = replace_once(
    canvas,
    '  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);\n',
    '  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);\n  useEffect(() => {\n    if (window.matchMedia("(max-width: 767px)").matches) {\n      setDesktopSidebarOpen(false);\n    }\n  }, []);\n',
    "canvas mobile sidebar initial state",
)
canvas_path.write_text(canvas)

canvas_css_path = Path(
    "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css"
)
canvas_css = canvas_css_path.read_text()
canvas_mobile = r'''

@media (max-width: 767px) {
  .desktopCanvasPage,
  .desktopCanvasPageSidebarCollapsed {
    position: relative;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
  }

  .desktopCanvasSidebar {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 30;
    width: min(88vw, 340px);
    max-width: 340px;
    height: 100%;
    max-height: none;
    border-right: 1px solid var(--border, #deddd8);
    border-bottom: 0;
    box-shadow: 12px 0 32px rgb(32 32 29 / 14%);
  }

  .desktopCanvasPageSidebarCollapsed .desktopCanvasSidebar {
    display: none;
  }

  .desktopCanvasMain {
    grid-column: 1;
    grid-row: 1;
  }

  .desktopCanvasToolbar {
    min-width: 0;
    height: 42px;
    min-height: 42px;
    flex-basis: 42px;
  }

  .desktopCanvasToolbarStatus {
    min-width: 0;
    white-space: nowrap;
  }

  .desktopCanvasToolbarGroup {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }

  .desktopCanvasToolbarGroup::-webkit-scrollbar {
    display: none;
  }
}
'''
if "box-shadow: 12px 0 32px" in canvas_css:
    raise SystemExit("canvas mobile CSS already applied")
canvas_css_path.write_text(canvas_css + canvas_mobile)

# Source-contract regression test: mobile-only shell must coexist with the desktop shell.
test_path = Path("tests/mobile-responsive-shell.test.ts")
test_path.write_text(r'''import fs from "node:fs";
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
    expect(shell).toContain("<SectionRail state={state} dispatch={dispatch} />");
    expect(shell).toContain("<MobileNavigation");
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*\.project-rail \{[\s\S]*display: none;/);
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
    expect(css).toMatch(/\.section-workspace \.tool-sidebar \{[\s\S]*position: fixed;/);
  });

  it("starts the Canvas sidebar collapsed on mobile and keeps its desktop state otherwise", () => {
    expect(canvas).toContain('window.matchMedia("(max-width: 767px)").matches');
    expect(canvasCss).toMatch(/@media \(max-width: 767px\)[\s\S]*\.desktopCanvasSidebar \{[\s\S]*position: absolute;/);
    expect(canvasCss).toContain("width: min(88vw, 340px)");
  });
});
''')
