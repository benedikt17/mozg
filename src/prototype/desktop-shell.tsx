"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  projectSections,
  type ProjectSection,
} from "@/prototype/desktop-mock-data";
import {
  desktopPrototypeReducer,
  getActiveProject,
  getCommandResults,
  initialDesktopPrototypeState,
  type CommandResult,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { OverviewSectionWorkspace } from "@/prototype/overview/overview-section-workspace";
import { KnowledgeSidebar } from "@/prototype/knowledge/knowledge-sidebar";
import { KnowledgeWorkspace } from "@/prototype/knowledge/knowledge-workspace";
import { ContextPanelSlot } from "@/prototype/context-panels/context-panel-slot";
import { TasksSidebar } from "@/prototype/tasks/tasks-sidebar";
import { TasksWorkspace } from "@/prototype/tasks/tasks-workspace";
import { CanvasesSidebar } from "@/prototype/canvases/canvases-sidebar";
import { CanvasesWorkspace } from "@/prototype/canvases/canvases-workspace";
import { InboxSidebar } from "@/prototype/inbox/inbox-sidebar";
import { InboxWorkspace } from "@/prototype/inbox/inbox-workspace";
import { ApplicationHeader } from "@/prototype/shell/application-header";
import { CommandPalette } from "@/prototype/shell/command-palette";
import { SectionRail } from "@/prototype/shell/section-rail";
import "./desktop-shell.css";
import "./desktop-workspaces.css";
import "./desktop-knowledge.css";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function DesktopPrototypeShell(): React.JSX.Element {
  const [state, dispatch] = useReducer(
    desktopPrototypeReducer,
    initialDesktopPrototypeState,
  );
  const [commandQuery, setCommandQuery] = useState(getInitialCommandQuery);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const seededFromUrl = useRef(false);
  const commandResults = useMemo(
    () => getCommandResults(state, commandQuery),
    [state, commandQuery],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const isCommandShortcut =
        (event.ctrlKey || event.metaKey) && event.key === "k";
      if (isCommandShortcut) {
        event.preventDefault();
        setActiveCommandIndex(0);
        dispatch({ type: "open-command-palette" });
      }
      if (event.key === "Escape") {
        dispatch({ type: "close-command-palette" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (seededFromUrl.current) return;
    seededFromUrl.current = true;
    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get("section");
    const section = projectSections.some((item) => item.id === sectionParam)
      ? (sectionParam as ProjectSection)
      : null;
    if (section) {
      dispatch({ type: "switch-section", section });
    }
    if (params.get("search")) {
      dispatch({
        type: "set-knowledge-search",
        query: params.get("search") ?? "",
      });
    }
    const documentId = params.get("document") ?? "doc-l-routes";
    if (section === "knowledge" || params.get("document")) {
      dispatch({ type: "select-document", documentId });
    }
    if (params.get("split") === "1") {
      dispatch({ type: "toggle-knowledge-split-view" });
    }
    if (params.get("detail") === "task") {
      dispatch({
        type: "select-task",
        taskId: "luko-characters-map",
        section: section === "overview" ? "overview" : "tasks",
      });
    }
    if (params.get("detail") === "inbox") {
      dispatch({ type: "select-inbox-item", itemId: "inbox-l-text" });
    }
    if (params.get("context") === "document") {
      dispatch({ type: "open-document-context", documentId });
    }
    if (params.get("ai") === "1") {
      dispatch({ type: "open-ai-panel" });
    }
    if (params.get("command") === "1") {
      dispatch({ type: "open-command-palette" });
    }
    if (params.get("rail") === "collapsed") {
      dispatch({ type: "toggle-project-rail" });
    }
    const editingTaskId = params.get("editTask");
    if (editingTaskId) {
      dispatch({ type: "begin-task-title-edit", taskId: editingTaskId });
    }
  }, []);

  const activateCommandResult = (result: CommandResult): void => {
    dispatch({ type: "activate-command-result", result });
    setCommandQuery("");
  };

  const activeProject = getActiveProject(state);
  const overviewReaderActive =
    state.activeSection === "overview" &&
    state.overviewArticleSourceTaskId !== null &&
    state.overviewArticlePreviewDocumentId !== null;

  return (
    <main
      className={[
        "desktop-prototype",
        state.activeSection === "knowledge" ? "knowledge-active" : "",
        state.activeSection === "knowledge" && state.splitViewDocumentId
          ? "knowledge-split-active"
          : "",
        state.projectRailCollapsed ? "project-rail-collapsed" : "",
        state.activeSection === "overview" &&
        state.contextPanel?.kind === "task" &&
        !overviewReaderActive
          ? "overview-task-drawer-open"
          : "",
        state.activeSection === "tasks" && state.contextPanel?.kind === "task"
          ? "tasks-task-drawer-open"
          : "",
        state.activeSection === "knowledge" &&
        state.contextPanel?.kind === "knowledge-tasks"
          ? "knowledge-task-link-drawer-open"
          : "",
        state.activeSection === "knowledge" &&
        state.contextPanel?.kind === "knowledge-task-reference"
          ? "knowledge-task-reference-drawer-open"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SectionRail state={state} dispatch={dispatch} />
      <div className="project-workspace">
        <ApplicationHeader state={state} dispatch={dispatch} />
        <SectionWorkspace state={state} dispatch={dispatch} />
      </div>
      {state.commandPaletteOpen ? (
        <CommandPalette
          activeIndex={activeCommandIndex}
          activeProjectName={activeProject.name}
          onActivate={activateCommandResult}
          onClose={() => dispatch({ type: "close-command-palette" })}
          onIndexChange={setActiveCommandIndex}
          onQueryChange={setCommandQuery}
          query={commandQuery}
          results={commandResults}
        />
      ) : null}
    </main>
  );
}

function SectionWorkspace({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const [knowledgeTreeOverlayOpen, setKnowledgeTreeOverlayOpen] =
    useState(false);
  const sidebar = renderToolSidebar(state, dispatch, {
    onCloseKnowledgeTree: () => setKnowledgeTreeOverlayOpen(false),
  });
  const overviewReaderActive =
    state.activeSection === "overview" &&
    state.overviewArticleSourceTaskId !== null &&
    state.overviewArticlePreviewDocumentId !== null;
  const hasContextPanel =
    state.contextPanel !== null &&
    (state.activeSection !== "overview" ||
      (state.contextPanel.kind === "task" && !overviewReaderActive));
  const hasFullHeightDrawer =
    state.contextPanel?.kind === "knowledge-tasks" ||
    state.contextPanel?.kind === "knowledge-task-reference" ||
    (state.activeSection === "tasks" && state.contextPanel?.kind === "task");
  return (
    <div
      className={[
        "section-workspace",
        `workspace-policy-${workspaceWidthPolicy(state)}`,
        `section-${state.activeSection}`,
        sidebar ? "has-tool-sidebar" : "",
        hasContextPanel ? "has-context-panel" : "",
        hasFullHeightDrawer ? "has-full-height-drawer" : "",
        overviewReaderActive ? "has-overview-contextual-reader" : "",
        state.activeSection === "knowledge" && state.splitViewDocumentId
          ? "has-split-view"
          : "",
        state.activeSection === "knowledge" && knowledgeTreeOverlayOpen
          ? "is-knowledge-tree-open"
          : "",
        state.activeSection === "knowledge" && state.contextPanel?.kind === "ai"
          ? "has-wide-context-panel"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {sidebar}
      <section className="main-workspace" aria-label="Рабочая область">
        {renderMainWorkspace(state, dispatch, {
          onOpenKnowledgeTree: () => setKnowledgeTreeOverlayOpen(true),
        })}
      </section>
      {state.activeSection === "knowledge" && knowledgeTreeOverlayOpen ? (
        <button
          aria-label="Закрыть дополнительную панель"
          className="knowledge-overlay-backdrop"
          onClick={() => setKnowledgeTreeOverlayOpen(false)}
          type="button"
        />
      ) : null}
      {hasContextPanel ? (
        <ContextPanelSlot
          contextPanel={state.contextPanel}
          dispatch={dispatch}
          state={state}
        />
      ) : null}
    </div>
  );
}

function workspaceWidthPolicy(
  state: DesktopPrototypeState,
): "full-surface" | "readable-document" {
  if (state.activeSection === "knowledge") return "readable-document";
  return "full-surface";
}

function getInitialCommandQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("commandQuery") ?? "";
}

function renderToolSidebar(
  state: DesktopPrototypeState,
  dispatch: Dispatch,
  options?: { onCloseKnowledgeTree?: () => void },
): React.JSX.Element | null {
  if (state.activeSection === "knowledge") {
    return (
      <KnowledgeSidebar
        state={state}
        dispatch={dispatch}
        onClose={options?.onCloseKnowledgeTree}
      />
    );
  }
  if (state.activeSection === "tasks") {
    return <TasksSidebar state={state} dispatch={dispatch} />;
  }
  if (state.activeSection === "canvases") {
    return <CanvasesSidebar state={state} dispatch={dispatch} />;
  }
  if (state.activeSection === "inbox") {
    return <InboxSidebar state={state} dispatch={dispatch} />;
  }
  return null;
}

function renderMainWorkspace(
  state: DesktopPrototypeState,
  dispatch: Dispatch,
  options?: {
    onOpenKnowledgeTree?: () => void;
  },
): React.JSX.Element {
  if (state.activeSection === "knowledge") {
    return (
      <KnowledgeWorkspace
        state={state}
        dispatch={dispatch}
        onOpenTree={options?.onOpenKnowledgeTree}
      />
    );
  }
  if (state.activeSection === "tasks") {
    return <TasksWorkspace state={state} dispatch={dispatch} />;
  }
  if (state.activeSection === "canvases") {
    return <CanvasesWorkspace state={state} dispatch={dispatch} />;
  }
  if (state.activeSection === "inbox") {
    return <InboxWorkspace state={state} dispatch={dispatch} />;
  }
  return <OverviewSectionWorkspace state={state} dispatch={dispatch} />;
}
