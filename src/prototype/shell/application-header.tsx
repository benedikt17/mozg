import React, { useEffect, useRef, useState } from "react";
import { publicProjectSections } from "@/prototype/desktop-mock-data";
import {
  getActiveProject,
  getKnowledgePaneState,
  getProjectOverviewDirections,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { UiIcon } from "@/prototype/desktop-icons";
import { PrototypeButton } from "@/prototype/desktop-ui";
import { KnowledgeBackupButton } from "@/prototype/knowledge/knowledge-backup-button";
import { createClient } from "@/lib/supabase/browser";
import {
  shouldShowAuthenticatedAccountControls,
  type DesktopRuntimeMode,
} from "@/lib/desktop-runtime-mode";
import { useRouter } from "next/navigation";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

function OverviewHeaderControls({
  directions,
  hiddenDirectionIds,
  dispatch,
}: {
  directions: ReturnType<typeof getProjectOverviewDirections>;
  hiddenDirectionIds: string[];
  dispatch: Dispatch;
}): React.JSX.Element {
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  return (
    <div
      className="overview-view-control"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        setViewMenuOpen(false);
      }}
    >
      <PrototypeButton
        aria-expanded={viewMenuOpen}
        aria-haspopup="menu"
        onClick={() => setViewMenuOpen((open) => !open)}
        size="compact"
        variant="quiet"
      >
        Вид
      </PrototypeButton>
      {viewMenuOpen ? (
        <>
          <button
            aria-label="Закрыть меню вида"
            className="overview-view-dismiss"
            onClick={() => setViewMenuOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div
            aria-label="Видимые направления проекта"
            className="overview-view-menu"
            role="menu"
          >
            {directions.map((direction) => (
              <label className="overview-view-option" key={direction.id}>
                <input
                  checked={!hiddenDirectionIds.includes(direction.id)}
                  onChange={(event) =>
                    dispatch({
                      type: "set-overview-direction-visible",
                      directionId: direction.id,
                      visible: event.currentTarget.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>{direction.title}</span>
              </label>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ApplicationSectionActions({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element | null {
  if (state.activeSection === "knowledge") {
    return <KnowledgeBackupButton state={state} />;
  }
  if (state.activeSection !== "overview") return null;
  return (
    <OverviewHeaderControls
      directions={getProjectOverviewDirections(state)}
      dispatch={dispatch}
      hiddenDirectionIds={state.overviewHiddenDirectionIds}
    />
  );
}

function ApplicationSectionNavigation({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <nav
      aria-label="Разделы приложения"
      className="application-section-navigation"
    >
      {publicProjectSections.map((section) => (
        <PrototypeButton
          active={state.activeSection === section.id}
          aria-current={state.activeSection === section.id ? "page" : undefined}
          className="application-section-navigation-item"
          key={section.id}
          onClick={() =>
            dispatch({ type: "switch-section", section: section.id })
          }
          variant="quiet"
        >
          {section.label}
        </PrototypeButton>
      ))}
    </nav>
  );
}

export function ApplicationHeader({
  state,
  dispatch,
  runtimeMode,
  mobileOverviewContextOpen = false,
  mobileToolSidebarOpen = false,
  onToggleMobileOverviewContext,
  onToggleMobileToolSidebar,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  runtimeMode: DesktopRuntimeMode;
  mobileOverviewContextOpen?: boolean;
  mobileToolSidebarOpen?: boolean;
  onToggleMobileOverviewContext?: () => void;
  onToggleMobileToolSidebar?: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const suppressMobileDrawerClickRef = useRef(false);
  const [canvasDrawerOpen, setCanvasDrawerOpen] = useState(false);
  const logout = async (): Promise<void> => {
    await createClient().auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  };
  const overviewReaderDrawer =
    state.activeSection === "overview" &&
    state.overviewArticleSourceTaskId !== null;
  const canvasDrawer = state.activeSection === "canvases";
  const hasMobileSectionDrawer =
    overviewReaderDrawer ||
    state.activeSection === "knowledge" ||
    state.activeSection === "tasks" ||
    canvasDrawer;
  const mobileDrawerOpen = canvasDrawer
    ? canvasDrawerOpen
    : overviewReaderDrawer
      ? mobileOverviewContextOpen
      : mobileToolSidebarOpen;
  const activeKnowledgeTitle =
    state.activeSection === "knowledge"
      ? (getKnowledgePaneState(state).activeDocument?.title ?? null)
      : null;

  useEffect(() => {
    if (canvasDrawer || !canvasDrawerOpen) return;
    const frame = window.requestAnimationFrame(() =>
      setCanvasDrawerOpen(false),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [canvasDrawer, canvasDrawerOpen]);

  const findCanvasDrawerToggle = (): HTMLButtonElement | null =>
    window.document.querySelector<HTMLButtonElement>(
      '[aria-label="Свернуть список холстов"], [aria-label="Развернуть список холстов"]',
    );

  const toggleCanvasDrawer = (): void => {
    const canvasToggle = findCanvasDrawerToggle();
    if (!canvasToggle) return;
    const opening =
      canvasToggle.getAttribute("aria-label") === "Развернуть список холстов";
    canvasToggle.click();
    setCanvasDrawerOpen(opening);
  };

  const closeCanvasDrawer = (): void => {
    const canvasToggle = findCanvasDrawerToggle();
    if (
      canvasToggle?.getAttribute("aria-label") === "Свернуть список холстов"
    ) {
      canvasToggle.click();
    }
    setCanvasDrawerOpen(false);
  };

  const toggleMobileSectionDrawer = (): void => {
    if (canvasDrawer) {
      toggleCanvasDrawer();
      return;
    }
    if (overviewReaderDrawer) {
      onToggleMobileOverviewContext?.();
      return;
    }
    onToggleMobileToolSidebar?.();
  };
  const handleMobileDrawerPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    suppressMobileDrawerClickRef.current = true;
    window.setTimeout(() => {
      suppressMobileDrawerClickRef.current = false;
    }, 700);
    toggleMobileSectionDrawer();
  };
  const handleMobileDrawerClick = (): void => {
    if (suppressMobileDrawerClickRef.current) {
      suppressMobileDrawerClickRef.current = false;
      return;
    }
    toggleMobileSectionDrawer();
  };
  return (
    <header className="application-header">
      <button
        className="application-project-title"
        onClick={() =>
          state.activeSection === "overview" &&
          state.overviewArticlePreviewDocumentId !== null
            ? dispatch({ type: "close-overview-article-preview" })
            : dispatch({ type: "switch-section", section: "overview" })
        }
        type="button"
      >
        <strong>{getActiveProject(state).name}</strong>
        {activeKnowledgeTitle ? (
          <span
            className="application-article-title"
            title={activeKnowledgeTitle}
          >
            {activeKnowledgeTitle}
          </span>
        ) : null}
      </button>
      {hasMobileSectionDrawer ? (
        <button
          aria-expanded={mobileDrawerOpen}
          aria-label={
            mobileDrawerOpen
              ? "Закрыть панель раздела"
              : "Открыть панель раздела"
          }
          className="mobile-tool-sidebar-trigger"
          onClick={handleMobileDrawerClick}
          onPointerDown={handleMobileDrawerPointerDown}
          type="button"
        >
          <UiIcon name={mobileDrawerOpen ? "close" : "panel-left"} />
        </button>
      ) : (
        <span className="mobile-tool-sidebar-spacer" aria-hidden="true" />
      )}
      {canvasDrawer && canvasDrawerOpen ? (
        <button
          aria-label="Закрыть дерево холстов"
          className="mobile-canvas-drawer-backdrop"
          onClick={closeCanvasDrawer}
          type="button"
        />
      ) : null}
      <ApplicationSectionNavigation state={state} dispatch={dispatch} />
      <div className="application-header-right">
        <ApplicationSectionActions state={state} dispatch={dispatch} />
        <div className="header-tools" aria-label="Глобальные инструменты">
          <PrototypeButton
            onClick={() => dispatch({ type: "open-command-palette" })}
            variant="quiet"
          >
            Поиск
          </PrototypeButton>
          {state.activeSection === "knowledge" ? null : (
            <PrototypeButton
              active={state.contextPanel?.kind === "ai"}
              onClick={() => dispatch({ type: "open-ai-panel" })}
              variant="quiet"
            >
              AI
            </PrototypeButton>
          )}
          {shouldShowAuthenticatedAccountControls(runtimeMode) ? (
            <PrototypeButton onClick={logout} variant="quiet">
              Выйти
            </PrototypeButton>
          ) : null}
        </div>
      </div>
    </header>
  );
}
