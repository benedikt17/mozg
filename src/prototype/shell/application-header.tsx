import React, { useState } from "react";
import { inboxFilters } from "@/prototype/desktop-mock-data";
import {
  getCanvasById,
  getDocumentById,
  getProjectOverviewDirections,
  getProjectTaskFolders,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { PrototypeButton } from "@/prototype/desktop-ui";
import { ProjectSelector } from "./project-selector";

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

function getTaskViewTitle(state: DesktopPrototypeState): string {
  const selectedFolder = getProjectTaskFolders(state).find(
    (folder) => folder.id === state.selectedTaskFolderId,
  );
  const selectedDirection = getProjectOverviewDirections(state).find(
    (direction) => direction.id === state.selectedTaskDirectionId,
  );
  if (selectedFolder) return selectedFolder.title;
  if (selectedDirection) return selectedDirection.title;
  if (state.taskDayViewActive) return "Задачи на день";
  if (state.taskFilter === "important") return "Важные";
  if (state.taskFilter === "completed") return "Завершённые";
  return "Все";
}

function ApplicationSectionHeader({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  if (state.activeSection === "overview") {
    return (
      <div className="application-section-header">
        <div className="application-section-title">
          <strong>Обзор</strong>
        </div>
        <div className="application-section-actions">
          <OverviewHeaderControls
            directions={getProjectOverviewDirections(state)}
            dispatch={dispatch}
            hiddenDirectionIds={state.overviewHiddenDirectionIds}
          />
        </div>
      </div>
    );
  }

  if (state.activeSection === "knowledge") {
    const selectedDocument = getDocumentById(state, state.selectedDocumentId);
    return (
      <div className="application-section-header">
        <div className="application-section-title">
          <span>Знания</span>
          <strong>{selectedDocument?.title ?? "Документ"}</strong>
        </div>
      </div>
    );
  }

  if (state.activeSection === "tasks") {
    return (
      <div className="application-section-header">
        <div className="application-section-title">
          <span>Задачи</span>
          <strong>{getTaskViewTitle(state)}</strong>
        </div>
      </div>
    );
  }

  if (state.activeSection === "canvases") {
    const canvas = getCanvasById(state, state.selectedCanvasId);
    return (
      <div className="application-section-header">
        <div className="application-section-title">
          <span>Холсты</span>
          <strong>{canvas?.title ?? "Карты"}</strong>
        </div>
        {canvas ? (
          <div className="application-section-actions canvas-header-actions">
            <button type="button">−</button>
            <button type="button">100%</button>
            <button type="button">+</button>
          </div>
        ) : null}
      </div>
    );
  }

  const inboxFilter = inboxFilters.find(
    (filter) => filter.id === state.inboxFilter,
  );
  return (
    <div className="application-section-header">
      <div className="application-section-title">
        <span>Входящие</span>
        <strong>{inboxFilter?.label ?? "Входящие"}</strong>
      </div>
    </div>
  );
}

export function ApplicationHeader({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <header className="application-header knowledge-application-header">
      <ProjectSelector state={state} dispatch={dispatch} />
      <ApplicationSectionHeader state={state} dispatch={dispatch} />
      <div className="header-tools" aria-label="Глобальные инструменты">
        <PrototypeButton
          onClick={() => dispatch({ type: "open-command-palette" })}
          variant="quiet"
        >
          Поиск
        </PrototypeButton>
        <PrototypeButton
          active={state.contextPanel?.kind === "ai"}
          onClick={() => dispatch({ type: "open-ai-panel" })}
          variant="quiet"
        >
          AI
        </PrototypeButton>
        <PrototypeButton variant="quiet">Профиль</PrototypeButton>
      </div>
    </header>
  );
}
