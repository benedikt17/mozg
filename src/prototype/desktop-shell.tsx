"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  isPublicProjectSection,
  publicProjectSections,
  type ProjectSection,
} from "@/prototype/desktop-mock-data";
import {
  desktopPrototypeReducer,
  getActiveProject,
  getCommandResults,
  getOverviewTaskDetailMaterial,
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
import { TasksDndProvider } from "@/prototype/tasks/tasks-dnd-context";
import { CanvasesSidebar } from "@/prototype/canvases/canvases-sidebar";
import { CanvasesWorkspace } from "@/prototype/canvases/canvases-workspace";
import { InboxSidebar } from "@/prototype/inbox/inbox-sidebar";
import { InboxWorkspace } from "@/prototype/inbox/inbox-workspace";
import { ApplicationHeader } from "@/prototype/shell/application-header";
import { CommandPalette } from "@/prototype/shell/command-palette";
import { SectionRail } from "@/prototype/shell/section-rail";
import {
  useDesktopPersistence,
  type UseDesktopPersistenceResult,
} from "@/prototype/persistence/use-desktop-persistence";
import type { DesktopPersistenceErrorCode } from "@/prototype/persistence/persistence-adapter";
import type { DesktopCloudBootstrap } from "@/prototype/persistence/cloud-snapshot-bridge";
import type { DesktopRuntimeMode } from "@/lib/desktop-runtime-mode";
import "./desktop-shell.css";
import "./desktop-workspaces.css";
import "./desktop-knowledge.css";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function DesktopPrototypeShell({
  cloudBootstrap,
  runtimeMode,
}: {
  cloudBootstrap?: DesktopCloudBootstrap;
  runtimeMode: DesktopRuntimeMode;
}): React.JSX.Element {
  const [state, dispatch] = useReducer(
    desktopPrototypeReducer,
    cloudBootstrap?.snapshot,
    initializeDesktopPrototypeState,
  );
  const [commandQuery, setCommandQuery] = useState(getInitialCommandQuery);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const seededFromUrl = useRef(false);
  const persistence = useDesktopPersistence(state, dispatch, {
    enabled: true,
    cloudBootstrap,
    runtimeMode,
  });
  const workspaceAvailable =
    persistence.lifecycle.status !== "loading" &&
    persistence.lifecycle.status !== "load-error";
  const commandResults = useMemo(
    () => getCommandResults(state, commandQuery),
    [state, commandQuery],
  );

  useEffect(() => {
    if (!workspaceAvailable) return;
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
  }, [workspaceAvailable]);

  useEffect(() => {
    if (!workspaceAvailable) return;
    if (isPublicProjectSection(state.activeSection)) return;
    dispatch({ type: "switch-section", section: "overview" });
  }, [state.activeSection, workspaceAvailable]);

  useEffect(() => {
    if (!workspaceAvailable) return;
    if (seededFromUrl.current) return;
    seededFromUrl.current = true;
    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get("section");
    const section = publicProjectSections.some(
      (item) => item.id === sectionParam,
    )
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
    const editingTaskId = params.get("editTask");
    if (editingTaskId) {
      dispatch({ type: "begin-task-title-edit", taskId: editingTaskId });
    }
  }, [workspaceAvailable]);

  const activateCommandResult = (result: CommandResult): void => {
    dispatch({ type: "activate-command-result", result });
    setCommandQuery("");
  };

  if (!workspaceAvailable) {
    return <DesktopPersistenceBoundary persistence={persistence} />;
  }

  const activeProject = getActiveProject(state);
  return (
    <main
      className={[
        "desktop-prototype",
        state.activeSection === "knowledge" ? "knowledge-active" : "",
        state.activeSection === "knowledge" && state.knowledgeSplitEnabled
          ? "knowledge-split-active"
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
        state.activeSection === "knowledge" &&
        state.contextPanel?.kind === "knowledge-task-attach"
          ? "knowledge-task-attach-drawer-open"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SectionRail state={state} dispatch={dispatch} />
      <div className="project-workspace">
        <ApplicationHeader
          dispatch={dispatch}
          runtimeMode={runtimeMode}
          state={state}
        />
        <SectionWorkspace state={state} dispatch={dispatch} />
      </div>
      <DesktopPersistenceStatus persistence={persistence} />
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

function initializeDesktopPrototypeState(
  snapshot: DesktopCloudBootstrap["snapshot"] | undefined,
): DesktopPrototypeState {
  if (!snapshot) return initialDesktopPrototypeState;
  return desktopPrototypeReducer(initialDesktopPrototypeState, {
    type: "hydrate-domain",
    snapshot,
  });
}

function DesktopPersistenceBoundary({
  persistence,
}: {
  persistence: UseDesktopPersistenceResult;
}): React.JSX.Element {
  if (persistence.lifecycle.status === "load-error") {
    return (
      <main className="desktop-prototype desktop-persistence-boundary">
        <div className="desktop-persistence-message" role="alert">
          <strong>Не удалось загрузить рабочее пространство</strong>
          <span>Код ошибки: {persistence.lifecycle.error.code}</span>
          <button
            className="ui-button"
            onClick={persistence.retryLoad}
            type="button"
          >
            Повторить
          </button>
        </div>
      </main>
    );
  }
  return (
    <main className="desktop-prototype desktop-persistence-boundary">
      <p role="status">Загрузка рабочего пространства…</p>
    </main>
  );
}

function DesktopPersistenceStatus({
  persistence,
}: {
  persistence: UseDesktopPersistenceResult;
}): React.JSX.Element | null {
  if (persistence.lifecycle.status === "ready") {
    return (
      <div
        aria-live="polite"
        className="desktop-persistence-status"
        role="status"
      >
        Сохранено
      </div>
    );
  }
  if (persistence.lifecycle.status === "saving") {
    return (
      <div
        aria-live="polite"
        className="desktop-persistence-status"
        role="status"
      >
        Сохранение…
      </div>
    );
  }
  if (persistence.lifecycle.status === "save-error") {
    return (
      <div className="desktop-persistence-status is-error" role="alert">
        <span>
          {getDesktopPersistenceStatusMessage(persistence.lifecycle.error.code)}
        </span>
        <button
          className="ui-button"
          onClick={persistence.retrySave}
          type="button"
        >
          Повторить
        </button>
      </div>
    );
  }
  return null;
}

export function getDesktopPersistenceStatusMessage(
  code: DesktopPersistenceErrorCode,
): string {
  return code === "conflict"
    ? "Конфликт изменений"
    : "Не удалось сохранить изменения";
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
  const [knowledgeSidebarCollapsed, setKnowledgeSidebarCollapsed] =
    useState(false);
  const sidebar = renderToolSidebar(state, dispatch, {
    onCloseKnowledgeTree: () => setKnowledgeTreeOverlayOpen(false),
  });
  const overviewSourceTask = state.tasks.find(
    (task) => task.id === state.overviewArticleSourceTaskId,
  );
  const overviewMaterial = overviewSourceTask
    ? getOverviewTaskDetailMaterial(state, overviewSourceTask.id)
    : null;
  const overviewPreviewDocument = state.documents.find(
    (document) =>
      document.id ===
      (overviewMaterial?.kind === "knowledge"
        ? overviewMaterial.documentId
        : null),
  );
  const overviewReaderActive =
    state.activeSection === "overview" &&
    overviewSourceTask?.projectId === state.activeProjectId &&
    overviewMaterial !== null &&
    (overviewMaterial.kind === "subtasks" ||
      (overviewPreviewDocument?.projectId === overviewSourceTask.projectId &&
        overviewSourceTask.linkedDocumentIds.includes(
          overviewPreviewDocument.id,
        )));
  const hasContextPanel =
    state.contextPanel !== null && state.activeSection !== "overview";
  const knowledgeAiOpen =
    state.activeSection === "knowledge" && state.contextPanel?.kind === "ai";
  const hasFullHeightDrawer =
    state.contextPanel?.kind === "knowledge-tasks" ||
    state.contextPanel?.kind === "knowledge-task-reference" ||
    state.contextPanel?.kind === "knowledge-task-attach" ||
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
        state.activeSection === "knowledge" && state.knowledgeSplitEnabled
          ? "has-split-view"
          : "",
        state.activeSection === "knowledge" && knowledgeTreeOverlayOpen
          ? "is-knowledge-tree-open"
          : "",
        state.activeSection === "knowledge" && knowledgeSidebarCollapsed
          ? "is-knowledge-sidebar-collapsed"
          : "",
        state.activeSection === "knowledge" && state.contextPanel?.kind === "ai"
          ? "has-wide-context-panel"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <TasksDndBoundary
        dispatch={dispatch}
        enabled={state.activeSection === "tasks"}
        state={state}
      >
        {sidebar}
        <section className="main-workspace" aria-label="Рабочая область">
          {renderMainWorkspace(state, dispatch, {
            aiPanel: knowledgeAiOpen ? (
              <ContextPanelSlot
                contextPanel={state.contextPanel}
                dispatch={dispatch}
                state={state}
              />
            ) : undefined,
            onOpenKnowledgeTree: () => {
              setKnowledgeSidebarCollapsed(false);
              setKnowledgeTreeOverlayOpen(true);
            },
            onToggleKnowledgeTree: () => {
              const isResponsive =
                typeof window !== "undefined" &&
                window.matchMedia("(max-width: 1023px)").matches;
              if (isResponsive) {
                setKnowledgeSidebarCollapsed(false);
                setKnowledgeTreeOverlayOpen((open) => !open);
                return;
              }
              setKnowledgeSidebarCollapsed((collapsed) => !collapsed);
            },
            treeOpen: knowledgeTreeOverlayOpen || !knowledgeSidebarCollapsed,
          })}
        </section>
      </TasksDndBoundary>
      {state.activeSection === "knowledge" && knowledgeTreeOverlayOpen ? (
        <button
          aria-label="Закрыть дополнительную панель"
          className="knowledge-overlay-backdrop"
          onClick={() => setKnowledgeTreeOverlayOpen(false)}
          type="button"
        />
      ) : null}
      {hasContextPanel && !knowledgeAiOpen ? (
        <ContextPanelSlot
          contextPanel={state.contextPanel}
          dispatch={dispatch}
          state={state}
        />
      ) : null}
    </div>
  );
}

function TasksDndBoundary({
  enabled,
  state,
  dispatch,
  children,
}: {
  enabled: boolean;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  children: React.ReactNode;
}): React.JSX.Element {
  if (!enabled) return <>{children}</>;
  return (
    <TasksDndProvider dispatch={dispatch} state={state}>
      {children}
    </TasksDndProvider>
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
    aiPanel?: React.ReactNode;
    onOpenKnowledgeTree?: () => void;
    onToggleKnowledgeTree?: () => void;
    treeOpen?: boolean;
  },
): React.JSX.Element {
  if (state.activeSection === "knowledge") {
    return (
      <KnowledgeWorkspace
        state={state}
        dispatch={dispatch}
        aiPanel={options?.aiPanel}
        onOpenTree={options?.onOpenKnowledgeTree}
        onToggleTree={options?.onToggleKnowledgeTree}
        treeOpen={options?.treeOpen}
      />
    );
  }
  if (state.activeSection === "tasks") {
    const taskSelectionKey =
      state.taskSelection.kind === "list"
        ? `list:${state.taskSelection.listId}`
        : `system:${state.taskSelection.view}`;
    return (
      <TasksWorkspace
        dispatch={dispatch}
        key={`${state.activeProjectId}:${taskSelectionKey}`}
        state={state}
      />
    );
  }
  if (state.activeSection === "canvases") {
    return <CanvasesWorkspace state={state} dispatch={dispatch} />;
  }
  if (state.activeSection === "inbox") {
    return <InboxWorkspace state={state} dispatch={dispatch} />;
  }
  return <OverviewSectionWorkspace state={state} dispatch={dispatch} />;
}
