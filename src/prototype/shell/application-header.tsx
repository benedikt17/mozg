import React, { useState } from "react";
import { publicProjectSections } from "@/prototype/desktop-mock-data";
import {
  getActiveProject,
  getProjectOverviewDirections,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { UiIcon } from "@/prototype/desktop-icons";
import { PrototypeButton } from "@/prototype/desktop-ui";
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
  mobileToolSidebarOpen = false,
  onToggleMobileToolSidebar,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  runtimeMode: DesktopRuntimeMode;
  mobileToolSidebarOpen?: boolean;
  onToggleMobileToolSidebar?: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const logout = async (): Promise<void> => {
    await createClient().auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  };
  const hasMobileSectionDrawer =
    state.activeSection === "knowledge" || state.activeSection === "tasks";
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
      </button>
      {hasMobileSectionDrawer ? (
        <button
          aria-expanded={mobileToolSidebarOpen}
          aria-label={
            mobileToolSidebarOpen
              ? "Закрыть панель раздела"
              : "Открыть панель раздела"
          }
          className="mobile-tool-sidebar-trigger"
          onClick={onToggleMobileToolSidebar}
          type="button"
        >
          <UiIcon name={mobileToolSidebarOpen ? "close" : "panel-left"} />
        </button>
      ) : (
        <span className="mobile-tool-sidebar-spacer" aria-hidden="true" />
      )}
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
