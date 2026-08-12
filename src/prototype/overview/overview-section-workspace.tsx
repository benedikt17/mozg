import React from "react";
import {
  getActiveDocumentById,
  getActiveProjectDocuments,
  getProjectOverviewDirections,
  getTaskById,
  getOverviewTaskDetailMaterial,
  getVisibleOverviewTasks,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { OverviewWorkspace } from "@/prototype/overview";
import { OverviewContextualReader } from "./overview-contextual-reader";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function OverviewSectionWorkspace({
  state,
  dispatch,
  mobileContextOpen = false,
  onMobileContextOpenChange,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  mobileContextOpen?: boolean;
  onMobileContextOpenChange?: (open: boolean) => void;
}): React.JSX.Element {
  const directions = getProjectOverviewDirections(state);
  const documents = getActiveProjectDocuments(state);
  const sourceTask = getTaskById(state, state.overviewArticleSourceTaskId);
  const material = sourceTask
    ? getOverviewTaskDetailMaterial(state, sourceTask.id)
    : null;
  const activeDocument = getActiveDocumentById(
    state,
    material?.kind === "knowledge" ? material.documentId : null,
    sourceTask?.projectId,
  );
  const sourceDirection = sourceTask
    ? directions.find(
        (direction) => direction.id === sourceTask.overviewDirectionId,
      )
    : undefined;
  const readerActive =
    sourceTask !== undefined &&
    sourceDirection !== undefined &&
    sourceTask.projectId === state.activeProjectId &&
    material !== null &&
    (material.kind === "subtasks" || activeDocument !== undefined);
  return (
    <div
      className={[
        "overview-mode-stage",
        readerActive ? "is-contextual-reader-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div inert={readerActive} className="overview-board-mode">
        <OverviewWorkspace
          directions={directions}
          dispatch={dispatch}
          documents={documents}
          expandedTaskId={state.overviewExpandedTaskId}
          hiddenDirectionIds={state.overviewHiddenDirectionIds}
          openTaskId={
            readerActive && state.contextPanel?.kind === "task"
              ? state.contextPanel.taskId
              : null
          }
          overviewScrollLeft={state.overviewScrollLeft}
          tasks={getVisibleOverviewTasks(state)}
        />
      </div>
      {readerActive ? (
        <OverviewContextualReader
          activeDocument={activeDocument}
          dispatch={dispatch}
          documents={documents}
          material={material ?? { kind: "subtasks" }}
          mobileContextOpen={mobileContextOpen}
          onMobileContextOpenChange={onMobileContextOpenChange}
          state={state}
          task={sourceTask}
        />
      ) : null}
    </div>
  );
}
