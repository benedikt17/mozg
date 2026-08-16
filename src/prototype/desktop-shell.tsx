"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  isPublicProjectSection,
  publicProjectSections,
  type ProjectSection,
} from "@/prototype/desktop-mock-data";
import {
  getActiveProject,
  getActiveDocumentById,
  getCommandResults,
  getOverviewTaskDetailMaterial,
  type CommandResult,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { OverviewSectionWorkspace } from "@/prototype/overview/overview-section-workspace";
import { KnowledgeSidebar } from "@/prototype/knowledge/knowledge-sidebar";
import { KnowledgeWorkspace } from "@/prototype/knowledge/knowledge-workspace";
import type { KnowledgeArticleLinkPickRequest } from "@/prototype/knowledge/markdown-source-editor";
import {
  KnowledgeContentHistoryProvider,
  useKnowledgeContentHistory,
} from "@/prototype/knowledge/knowledge-content-history-runtime";
import { ContextPanelSlot } from "@/prototype/context-panels/context-panel-slot";
import { TasksSidebar } from "@/prototype/tasks/tasks-sidebar";
import { TasksWorkspace } from "@/prototype/tasks/tasks-workspace";
import { TasksDndProvider } from "@/prototype/tasks/tasks-dnd-context";
import { InboxSidebar } from "@/prototype/inbox/inbox-sidebar";
import { InboxWorkspace } from "@/prototype/inbox/inbox-workspace";
import { DesktopCanvasWorkspace } from "@/prototype/canvases/desktop-canvas-workspace";
import { FilesWorkspace } from "@/prototype/files/files-workspace";
import { ApplicationHeader } from "@/prototype/shell/application-header";
import { SectionRail } from "@/prototype/shell/section-rail";
import { MobileNavigation } from "@/prototype/shell/mobile-navigation";
import type { UseDesktopPersistenceResult } from "@/prototype/persistence/use-desktop-persistence";
import type { DesktopPersistenceErrorCode } from "@/prototype/persistence/persistence-adapter";
import type { DesktopCloudBootstrap } from "@/prototype/persistence/cloud-snapshot-bridge";
import type { DesktopRuntimeMode } from "@/lib/desktop-runtime-mode";
import {
  DesktopTaskRuntimeProvider,
  useDesktopTaskRuntime,
} from "@/prototype/tasks/desktop-task-runtime";
import "./desktop-shell.css";
import "./desktop-workspaces.css";
import "./desktop-knowledge.css";

const CommandPalette = dynamic(
  () =>
    import("@/prototype/shell/command-palette").then(
      ({ CommandPalette }) => CommandPalette,
    ),
  { ssr: false },
);

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function DesktopPrototypeShell({
  cloudBootstrap,
  runtimeMode,
}: {
  cloudBootstrap?: DesktopCloudBootstrap;
  runtimeMode: DesktopRuntimeMode;
}): React.JSX.Element {
  return (
    <DesktopTaskRuntimeProvider
      cloudBootstrap={cloudBootstrap}
      runtimeMode={runtimeMode}
    >
      <KnowledgeContentHistoryProvider>
        <DesktopPrototypeShellContent runtimeMode={runtimeMode} />
      </KnowledgeContentHistoryProvider>
    </DesktopTaskRuntimeProvider>
  );
}

function DesktopPrototypeShellContent({
  runtimeMode,
}: {
  runtimeMode: DesktopRuntimeMode;
}): React.JSX.Element {
  const { dispatch, persistence, state, workspaceAvailable, workspaceId } =
    useDesktopTaskRuntime();
  const [commandQuery, setCommandQuery] = useState(getInitialCommandQuery);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [mobileToolSidebarOpen, setMobileToolSidebarOpen] = useState(false);
  const [mobileOverviewContextOpen, setMobileOverviewContextOpen] =
    useState(false);
  const seededFromUrl = useRef(false);
  const {
    activeProjectId,
    commandPaletteOpen,
    documents,
    inboxItems,
    projects,
    tasks,
  } = state;
  const commandResults = useMemo(
    () =>
      commandPaletteOpen
        ? getCommandResults(
            { activeProjectId, projects, tasks, documents, inboxItems },
            commandQuery,
          )
        : [],
    [
      activeProjectId,
      commandPaletteOpen,
      documents,
      inboxItems,
      projects,
      tasks,
      commandQuery,
    ],
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
    const overviewContextAvailable =
      state.activeSection === "overview" &&
      state.overviewArticleSourceTaskId !== null;
    if (overviewContextAvailable || !mobileOverviewContextOpen) return;
    const frame = window.requestAnimationFrame(() =>
      setMobileOverviewContextOpen(false),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [
    mobileOverviewContextOpen,
    state.activeSection,
    state.overviewArticleSourceTaskId,
  ]);

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
          mobileOverviewContextOpen={mobileOverviewContextOpen}
          mobileToolSidebarOpen={mobileToolSidebarOpen}
          onToggleMobileOverviewContext={() =>
            setMobileOverviewContextOpen((open) => !open)
          }
          onToggleMobileToolSidebar={() =>
            setMobileToolSidebarOpen((open) => !open)
          }
          runtimeMode={runtimeMode}
          state={state}
        />
        <SectionWorkspace
          dispatch={dispatch}
          mobileOverviewContextOpen={mobileOverviewContextOpen}
          mobileToolSidebarOpen={mobileToolSidebarOpen}
          onCloseMobileToolSidebar={() => setMobileToolSidebarOpen(false)}
          onMobileOverviewContextOpenChange={setMobileOverviewContextOpen}
          state={state}
          workspaceId={workspaceId}
        />
      </div>
      <MobileNavigation
        dispatch={dispatch}
        runtimeMode={runtimeMode}
        state={state}
      />
      <DesktopPersistenceStatus
        avoidRightPanel={
          state.contextPanel !== null && state.activeSection !== "overview"
        }
        persistence={persistence}
      />
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
  avoidRightPanel,
}: {
  persistence: UseDesktopPersistenceResult;
  avoidRightPanel: boolean;
}): React.JSX.Element | null {
  const className = [
    "desktop-persistence-status",
    avoidRightPanel ? "has-right-panel" : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (persistence.lifecycle.status === "ready") {
    return (
      <div aria-live="polite" className={className} role="status">
        Сохранено
      </div>
    );
  }
  if (persistence.lifecycle.status === "saving") {
    return (
      <div aria-live="polite" className={className} role="status">
        Сохранение…
      </div>
    );
  }
  if (
    persistence.lifecycle.status === "save-error" ||
    persistence.lifecycle.status === "conflict"
  ) {
    const isConflict = persistence.lifecycle.status === "conflict";
    return (
      <div className={`${className} is-error`} role="alert">
        <span>
          {getDesktopPersistenceStatusMessage(persistence.lifecycle.error.code)}
        </span>
        {isConflict ? null : (
          <button
            className="ui-button"
            onClick={persistence.retrySave}
            type="button"
          >
            Повторить
          </button>
        )}
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
  workspaceId,
  mobileOverviewContextOpen,
  mobileToolSidebarOpen,
  onCloseMobileToolSidebar,
  onMobileOverviewContextOpenChange,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  workspaceId?: string;
  mobileOverviewContextOpen: boolean;
  mobileToolSidebarOpen: boolean;
  onCloseMobileToolSidebar: () => void;
  onMobileOverviewContextOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const knowledgeHistory = useKnowledgeContentHistory();
  const [knowledgeTreeOverlayOpen, setKnowledgeTreeOverlayOpen] =
    useState(false);
  const [knowledgeSidebarCollapsed, setKnowledgeSidebarCollapsed] =
    useState(false);
  const [knowledgeArticleLinkPicker, setKnowledgeArticleLinkPicker] =
    useState<KnowledgeArticleLinkPickRequest | null>(null);
  const knowledgeDispatch = knowledgeHistory.dispatchKnowledgeAction;
  const activeKnowledgeArticleLinkPicker =
    state.activeSection === "knowledge" &&
    knowledgeArticleLinkPicker &&
    state.documents.some(
      (document) =>
        document.id === knowledgeArticleLinkPicker.sourceDocumentId &&
        document.projectId === state.activeProjectId,
    )
      ? knowledgeArticleLinkPicker
      : null;

  useEffect(() => {
    if (!activeKnowledgeArticleLinkPicker) return;
    const cancelOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setKnowledgeArticleLinkPicker(null);
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [activeKnowledgeArticleLinkPicker]);

  const beginKnowledgeArticleLinkPick = (
    request: KnowledgeArticleLinkPickRequest,
  ): void => {
    setKnowledgeArticleLinkPicker(request);
    setKnowledgeSidebarCollapsed(false);
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      setKnowledgeTreeOverlayOpen(true);
    }
  };

  const pickKnowledgeArticleLinkTarget = (documentId: string): void => {
    const picker = activeKnowledgeArticleLinkPicker;
    if (!picker || documentId === picker.sourceDocumentId) return;
    setKnowledgeArticleLinkPicker(null);
    picker.onPick(documentId);
    setKnowledgeTreeOverlayOpen(false);
  };
  const sidebar = renderToolSidebar(
    state,
    state.activeSection === "knowledge" ? knowledgeDispatch : dispatch,
    {
      onCloseKnowledgeTree: () => setKnowledgeTreeOverlayOpen(false),
      linkPickerSourceDocumentId:
        activeKnowledgeArticleLinkPicker?.sourceDocumentId ?? null,
      onCancelKnowledgeLinkPick: () => setKnowledgeArticleLinkPicker(null),
      onPickKnowledgeLinkTarget: pickKnowledgeArticleLinkTarget,
    },
  );
  const overviewSourceTask = state.tasks.find(
    (task) => task.id === state.overviewArticleSourceTaskId,
  );
  const overviewMaterial = overviewSourceTask
    ? getOverviewTaskDetailMaterial(state, overviewSourceTask.id)
    : null;
  const overviewPreviewDocument = getActiveDocumentById(
    state,
    overviewMaterial?.kind === "knowledge" ? overviewMaterial.documentId : null,
    overviewSourceTask?.projectId,
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
    (state.activeSection === "tasks" && state.contextPanel?.kind === "task") ||
    (state.activeSection === "canvases" && state.contextPanel?.kind === "task");
  return (
    <div
      className={[
        "section-workspace",
        `workspace-policy-${workspaceWidthPolicy(state)}`,
        `section-${state.activeSection}`,
        sidebar ? "has-tool-sidebar" : "",
        sidebar && mobileToolSidebarOpen ? "is-mobile-tool-sidebar-open" : "",
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
          {renderMainWorkspace(
            state,
            state.activeSection === "knowledge" ? knowledgeDispatch : dispatch,
            {
              aiPanel: knowledgeAiOpen ? (
                <ContextPanelSlot
                  contextPanel={state.contextPanel}
                  dispatch={dispatch}
                  state={state}
                />
              ) : undefined,
              mobileOverviewContextOpen,
              onMobileOverviewContextOpenChange,
              onBeginArticleLinkPick: beginKnowledgeArticleLinkPick,
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
              workspaceId,
            },
          )}
        </section>
      </TasksDndBoundary>
      {sidebar && mobileToolSidebarOpen ? (
        <button
          aria-label="Закрыть панель раздела"
          className="mobile-tool-sidebar-backdrop"
          onClick={onCloseMobileToolSidebar}
          type="button"
        />
      ) : null}
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
  options?: {
    onCloseKnowledgeTree?: () => void;
    linkPickerSourceDocumentId?: string | null;
    onCancelKnowledgeLinkPick?: () => void;
    onPickKnowledgeLinkTarget?: (documentId: string) => void;
  },
): React.JSX.Element | null {
  if (state.activeSection === "knowledge") {
    return (
      <KnowledgeSidebar
        state={state}
        dispatch={dispatch}
        onClose={options?.onCloseKnowledgeTree}
        linkPickerSourceDocumentId={options?.linkPickerSourceDocumentId}
        onCancelLinkPick={options?.onCancelKnowledgeLinkPick}
        onPickLinkTarget={options?.onPickKnowledgeLinkTarget}
      />
    );
  }
  if (state.activeSection === "tasks") {
    return <TasksSidebar state={state} dispatch={dispatch} />;
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
    mobileOverviewContextOpen?: boolean;
    onMobileOverviewContextOpenChange?: (open: boolean) => void;
    onBeginArticleLinkPick?: (request: KnowledgeArticleLinkPickRequest) => void;
    onOpenKnowledgeTree?: () => void;
    onToggleKnowledgeTree?: () => void;
    treeOpen?: boolean;
    workspaceId?: string;
  },
): React.JSX.Element {
  if (state.activeSection === "knowledge") {
    return (
      <KnowledgeWorkspace
        state={state}
        dispatch={dispatch}
        aiPanel={options?.aiPanel}
        onBeginArticleLinkPick={options?.onBeginArticleLinkPick}
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
    return (
      <DesktopCanvasWorkspace
        activeTaskDetailsTaskId={
          state.contextPanel?.kind === "task"
            ? state.contextPanel.taskId
            : undefined
        }
        workspaceId={options?.workspaceId}
      />
    );
  }
  if (state.activeSection === "files") {
    return (
      <FilesWorkspace
        key={`${options?.workspaceId ?? "local"}:${state.activeProjectId}`}
        projectId={state.activeProjectId}
        projectName={getActiveProject(state).name}
        workspaceId={options?.workspaceId}
      />
    );
  }
  if (state.activeSection === "inbox") {
    return <InboxWorkspace state={state} dispatch={dispatch} />;
  }
  return (
    <OverviewSectionWorkspace
      dispatch={dispatch}
      mobileContextOpen={options?.mobileOverviewContextOpen ?? false}
      onMobileContextOpenChange={options?.onMobileOverviewContextOpenChange}
      state={state}
    />
  );
}
