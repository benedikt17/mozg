import type {
  ProjectSection,
  PrototypeProject,
} from "@/prototype/desktop-mock-data";
import type {
  CommandResult,
  DesktopPrototypeState,
} from "@/prototype/state/types";
import { publicProjectSections } from "@/prototype/desktop-mock-data";
import {
  getCanvasById,
  getCanvasObjectById,
} from "@/prototype/state/canvases-state";
import { getInboxItemById } from "@/prototype/state/inbox-state";
import {
  getDocumentBreadcrumb,
  getDocumentById,
  getDocumentTitle,
} from "@/prototype/state/knowledge-state";
import { getTaskById } from "@/prototype/state/tasks-state";

export const MAX_VISIBLE_COMMAND_RESULTS = 10;

export function getActiveProject(
  state: DesktopPrototypeState,
): PrototypeProject {
  return (
    state.projects.find((project) => project.id === state.activeProjectId) ??
    state.projects[0]
  );
}

export function getAiContextLabel(state: DesktopPrototypeState): string {
  const project = getActiveProject(state).name;
  if (state.activeSection === "knowledge") {
    const document = getDocumentById(state, state.selectedDocumentId);
    return `Проект: ${project} · Раздел: Знания · Документ: ${document?.title ?? "не выбран"}`;
  }
  if (state.activeSection === "tasks") {
    const task = getTaskById(state, state.selectedTaskId);
    return `Проект: ${project} · Раздел: Задачи · Задача: ${task?.title ?? "не выбрана"}`;
  }
  if (state.activeSection === "canvases") {
    const canvas = getCanvasById(state, state.selectedCanvasId);
    const object = getCanvasObjectById(
      state,
      state.selectedCanvasId,
      state.selectedCanvasObjectId,
    );
    return `Проект: ${project} · Раздел: Холсты · Холст: ${canvas?.title ?? "не выбран"}${object ? ` · Объект: ${object.title}` : ""}`;
  }
  if (state.activeSection === "inbox") {
    const item = getInboxItemById(state, state.selectedInboxItemId);
    return `Проект: ${project} · Раздел: Входящие · Захват: ${item?.title ?? "не выбран"}`;
  }
  const task = getTaskById(state, state.selectedTaskId);
  return `Проект: ${project} · Раздел: Обзор${task ? ` · Задача: ${task.title}` : ""}`;
}

export function getCommandResults(
  state: DesktopPrototypeState,
  query: string,
): CommandResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const matches = (value: string): boolean =>
    normalizedQuery.length === 0 ||
    value.toLocaleLowerCase("ru").includes(normalizedQuery);

  const projectResults: CommandResult[] = state.projects
    .filter((project) => matches(project.name))
    .map((project) => ({
      kind: "project",
      id: project.id,
      title: project.name,
      subtitle: "Проект",
    }));

  const sectionResults: CommandResult[] = [
    ["overview", "Обзор"],
    ["knowledge", "Знания"],
    ["tasks", "Задачи"],
    ["canvases", "Холсты"],
    ["inbox", "Входящие"],
  ]
    .filter(([id]) =>
      publicProjectSections.some((section) => section.id === id),
    )
    .filter(([, label]) => matches(label))
    .map(([id, label]) => ({
      kind: "section",
      id: id as ProjectSection,
      title: label,
      subtitle: "Раздел текущего проекта",
    }));

  const taskResults: CommandResult[] = state.tasks
    .filter((task) => matches(task.title))
    .map((task) => ({
      kind: "task",
      id: task.id,
      title: task.title,
      subtitle: `Задача · ${getProjectName(state, task.projectId)}`,
    }));

  const documentResults: CommandResult[] = state.documents
    .filter(
      (document) =>
        document.deletedAt === undefined &&
        (matches(getDocumentTitle(document)) ||
          matches(document.excerpt) ||
          matches(getDocumentBreadcrumb(document))),
    )
    .map((document) => ({
      kind: "document",
      id: document.id,
      title: getDocumentTitle(document),
      subtitle: `Документ · ${getProjectName(state, document.projectId)} · ${getDocumentBreadcrumb(document)}`,
    }));

  const canvasResults: CommandResult[] = state.canvases
    .filter((canvas) => matches(canvas.title))
    .map((canvas) => ({
      kind: "canvas",
      id: canvas.id,
      title: canvas.title,
      subtitle: `Холст · ${getProjectName(state, canvas.projectId)}`,
    }));

  const inboxResults: CommandResult[] = state.inboxItems
    .filter((item) => matches(item.title) || matches(item.preview))
    .map((item) => ({
      kind: "inbox",
      id: item.id,
      title: item.title,
      subtitle: `Р’С…РѕРґСЏС‰РµРµ В· ${getProjectName(state, item.projectId)}`,
    }));

  return visibleCommandResults(
    [
      ...projectResults,
      ...sectionResults,
      ...taskResults,
      ...documentResults,
      ...canvasResults,
      ...inboxResults,
    ].filter((result) => result.kind !== "canvas" && result.kind !== "inbox"),
  );
}

export function visibleCommandResults<T>(results: T[]): T[] {
  return results.slice(0, MAX_VISIBLE_COMMAND_RESULTS);
}

function getProjectName(
  state: DesktopPrototypeState,
  projectId: string,
): string {
  return (
    state.projects.find((project) => project.id === projectId)?.name ?? "Проект"
  );
}
