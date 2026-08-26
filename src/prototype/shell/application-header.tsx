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
import {
  classifyMobileSidebarSwipe,
  MOBILE_SIDEBAR_EDGE_START_PX,
} from "@/prototype/shell/mobile-sidebar-gesture";
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

function isInsideMobileSectionDrawer(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(".tool-sidebar, [data-mobile-section-drawer='true']"),
    )
  );
}

function isMobileSidebarNavigationButton(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest<HTMLButtonElement>("button");
  if (!button || !isInsideMobileSectionDrawer(button)) return false;
  if (button.closest('[role="menu"]') || button.hasAttribute("aria-haspopup"))
    return false;
  if (
    button.classList.contains("tool-sidebar-item") ||
    button.classList.contains("task-custom-list-select")
  )
    return true;
  if (button.closest("[data-knowledge-document-id]")) {
    return !button.classList.contains("knowledge-folder-menu-trigger");
  }
  return Boolean(button.closest("[data-canvas-id]"));
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

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 767px)");
    const supportsLeftSidebarSwipe =
      state.activeSection === "knowledge" ||
      state.activeSection === "tasks" ||
      state.activeSection === "canvases";
    if (!supportsLeftSidebarSwipe) return;

    type PointerGesture = {
      pointerId: number;
      startX: number;
      startY: number;
      startedInsideDrawer: boolean;
    };
    type TouchGesture = {
      identifier: number;
      startTarget: EventTarget | null;
      startX: number;
      startY: number;
      startedInsideDrawer: boolean;
    };
    let pointerGesture: PointerGesture | null = null;
    let touchGesture: TouchGesture | null = null;
    const preferNativeTouchEvents =
      "ontouchstart" in window || window.navigator.maxTouchPoints > 0;

    const drawerIsOpen = (): boolean =>
      state.activeSection === "canvases"
        ? canvasDrawerOpen
        : mobileToolSidebarOpen;

    const setDrawerOpen = (open: boolean): void => {
      if (!mobileViewport.matches || drawerIsOpen() === open) return;
      if (state.activeSection === "canvases") {
        const canvasToggle = window.document.querySelector<HTMLButtonElement>(
          '[aria-label="Свернуть список холстов"], [aria-label="Развернуть список холстов"]',
        );
        if (!canvasToggle) return;
        const currentlyOpen =
          canvasToggle.getAttribute("aria-label") === "Свернуть список холстов";
        if (currentlyOpen !== open) canvasToggle.click();
        setCanvasDrawerOpen(open);
        return;
      }
      onToggleMobileToolSidebar?.();
    };

    const applySwipe = (input: {
      endX: number;
      endY: number;
      startX: number;
      startY: number;
      startedInsideDrawer: boolean;
    }): boolean => {
      const action = classifyMobileSidebarSwipe({
        drawerOpen: drawerIsOpen(),
        endX: input.endX,
        endY: input.endY,
        startedInsideDrawer: input.startedInsideDrawer,
        startX: input.startX,
        startY: input.startY,
        viewportWidth: window.innerWidth,
      });
      if (action === "open") setDrawerOpen(true);
      if (action === "close") setDrawerOpen(false);
      return action !== null;
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (
        preferNativeTouchEvents ||
        !mobileViewport.matches ||
        event.pointerType !== "touch"
      )
        return;
      pointerGesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startedInsideDrawer: isInsideMobileSectionDrawer(event.target),
      };
    };

    const clearPointerGesture = (): void => {
      pointerGesture = null;
    };

    const onPointerUp = (event: PointerEvent): void => {
      const current = pointerGesture;
      clearPointerGesture();
      if (!current || current.pointerId !== event.pointerId) return;
      applySwipe({
        endX: event.clientX,
        endY: event.clientY,
        startedInsideDrawer: current.startedInsideDrawer,
        startX: current.startX,
        startY: current.startY,
      });
    };

    const findTouch = (
      touches: TouchList,
      identifier: number,
    ): Touch | null => {
      for (let index = 0; index < touches.length; index += 1) {
        const touch = touches.item(index);
        if (touch?.identifier === identifier) return touch;
      }
      return null;
    };

    const onTouchStart = (event: TouchEvent): void => {
      if (!preferNativeTouchEvents || !mobileViewport.matches) return;
      if (event.touches.length !== 1) {
        touchGesture = null;
        return;
      }
      const touch = event.touches.item(0);
      if (!touch) return;
      touchGesture = {
        identifier: touch.identifier,
        startTarget: event.target,
        startX: touch.clientX,
        startY: touch.clientY,
        startedInsideDrawer: isInsideMobileSectionDrawer(event.target),
      };
    };

    const onTouchMove = (event: TouchEvent): void => {
      const current = touchGesture;
      if (!current || !mobileViewport.matches) return;
      const touch = findTouch(event.touches, current.identifier);
      if (!touch) return;
      const deltaX = touch.clientX - current.startX;
      const deltaY = touch.clientY - current.startY;
      const horizontal =
        Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1;
      const eligible = drawerIsOpen()
        ? current.startedInsideDrawer && deltaX < 0
        : current.startX <= MOBILE_SIDEBAR_EDGE_START_PX && deltaX > 0;
      if (horizontal && eligible) event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent): void => {
      const current = touchGesture;
      touchGesture = null;
      if (!current || !mobileViewport.matches) return;
      const touch = findTouch(event.changedTouches, current.identifier);
      if (!touch) return;
      const handledSwipe = applySwipe({
        endX: touch.clientX,
        endY: touch.clientY,
        startedInsideDrawer: current.startedInsideDrawer,
        startX: current.startX,
        startY: current.startY,
      });
      if (handledSwipe) {
        event.preventDefault();
        return;
      }

      const deltaX = touch.clientX - current.startX;
      const deltaY = touch.clientY - current.startY;
      const isTap = Math.abs(deltaX) <= 12 && Math.abs(deltaY) <= 12;
      if (
        !isTap ||
        !drawerIsOpen() ||
        !isMobileSidebarNavigationButton(current.startTarget)
      )
        return;
      if (!(current.startTarget instanceof Element)) return;
      const button = current.startTarget.closest<HTMLButtonElement>("button");
      if (!button || button.disabled) return;
      event.preventDefault();
      button.click();
    };

    const clearTouchGesture = (): void => {
      touchGesture = null;
    };

    const onClick = (event: MouseEvent): void => {
      if (!mobileViewport.matches || !drawerIsOpen()) return;
      if (!isMobileSidebarNavigationButton(event.target)) return;
      window.setTimeout(() => setDrawerOpen(false), 0);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", clearPointerGesture, true);
    window.addEventListener("touchstart", onTouchStart, {
      capture: true,
      passive: true,
    });
    window.addEventListener("touchmove", onTouchMove, {
      capture: true,
      passive: false,
    });
    window.addEventListener("touchend", onTouchEnd, {
      capture: true,
      passive: false,
    });
    window.addEventListener("touchcancel", clearTouchGesture, true);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", clearPointerGesture, true);
      window.removeEventListener("touchstart", onTouchStart, true);
      window.removeEventListener("touchmove", onTouchMove, true);
      window.removeEventListener("touchend", onTouchEnd, true);
      window.removeEventListener("touchcancel", clearTouchGesture, true);
      window.removeEventListener("click", onClick);
    };
  }, [
    canvasDrawerOpen,
    mobileToolSidebarOpen,
    onToggleMobileToolSidebar,
    state.activeSection,
  ]);

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
