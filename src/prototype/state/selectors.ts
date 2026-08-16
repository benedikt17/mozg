import type {
  ProjectSection,
  PrototypeDocument,
  PrototypeProject,
} from "@/prototype/desktop-mock-data";
import type {
  CommandResult,
  DesktopPrototypeState,
} from "@/prototype/state/types";
import { publicProjectSections } from "@/prototype/desktop-mock-data";
import { getInboxItemById } from "@/prototype/state/inbox-state";
import {
  getDocumentBreadcrumb,
  getDocumentById,
  getDocumentTitle,
} from "@/prototype/state/knowledge-state";
import { getTaskById } from "@/prototype/state/tasks-state";

export const MAX_VISIBLE_COMMAND_RESULTS = 10;

const DOCUMENT_SEARCH_SNIPPET_RADIUS = 72;

type CommandSearchState = Pick<
  DesktopPrototypeState,
  "activeProjectId" | "projects" | "tasks" | "documents" | "inboxItems"
>;

export function getActiveProject(
  state: DesktopPrototypeState,
): PrototypeProject {
  return (
    state.projects.find((project) => project.id === state.activeProjectId) ??
    state.projects[0]
  );
}

/**
 * Derive the reverse Task → Knowledge projection from the authoritative task
 * relation. This is intentionally not read from or written to documents.
 */
export function getLinkedTaskIdsForDocument(
  state: DesktopPrototypeState,
  documentId: string,
): string[] {
  return state.tasks
    .filter((task) => task.linkedDocumentIds.includes(documentId))
    .map((task) => task.id);
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
    return `Проект: ${project} · Раздел: Холсты`;
  }
  if (state.activeSection === "inbox") {
    const item = getInboxItemById(state, state.selectedInboxItemId);
    return `Проект: ${project} · Раздел: Входящие · Захват: ${item?.title ?? "не выбран"}`;
  }
  const task = getTaskById(state, state.selectedTaskId);
  return `Проект: ${project} · Раздел: Обзор${task ? ` · Задача: ${task.title}` : ""}`;
}

export function getCommandResults(
  state: CommandSearchState,
  query: string,
): CommandResult[] {
  const normalizedQuery = normalizeSearchValue(query.trim());
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const matches = (value: string): boolean => matchesSearchTerms(value, terms);

  const activeProject = state.projects.find(
    (project) => project.id === state.activeProjectId,
  );
  const projectResults: CommandResult[] =
    activeProject && matches(activeProject.name)
      ? [
          {
            kind: "project",
            id: activeProject.id,
            title: activeProject.name,
            subtitle: "Текущий проект",
          },
        ]
      : [];

  const sectionResults: CommandResult[] = [
    ["overview", "Обзор"],
    ["knowledge", "Знания"],
    ["tasks", "Задачи"],
    ["canvases", "Холсты"],
    ["files", "Файлы"],
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
    .filter(
      (task) => task.projectId === state.activeProjectId && matches(task.title),
    )
    .map((task) => ({
      kind: "task",
      id: task.id,
      title: task.title,
      subtitle: "Задача текущего проекта",
    }));

  const documentResults: CommandResult[] = state.documents
    .filter(
      (document) =>
        document.projectId === state.activeProjectId &&
        document.deletedAt === undefined,
    )
    .map((document) => ({
      document,
      score: documentSearchScore(document, terms, normalizedQuery),
    }))
    .filter(({ score }) => terms.length === 0 || score > 0)
    .sort(
      (first, second) =>
        second.score - first.score ||
        getDocumentTitle(first.document).localeCompare(
          getDocumentTitle(second.document),
          "ru",
        ),
    )
    .map(({ document }) => {
      const snippet = getDocumentSearchSnippet(
        document,
        terms,
        normalizedQuery,
      );
      return {
        kind: "document" as const,
        id: document.id,
        title: getDocumentTitle(document),
        subtitle: ["Документ", getDocumentBreadcrumb(document), snippet]
          .filter(Boolean)
          .join(" · "),
      };
    });

  if (terms.length > 0) {
    return [
      ...documentResults,
      ...visibleCommandResults([
        ...projectResults,
        ...sectionResults,
        ...taskResults,
      ]),
    ];
  }

  return visibleCommandResults([
    ...projectResults,
    ...sectionResults,
    ...taskResults,
    ...documentResults,
  ]);
}

export function visibleCommandResults<T>(results: T[]): T[] {
  return results.slice(0, MAX_VISIBLE_COMMAND_RESULTS);
}

function normalizeSearchValue(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("ru");
}

function matchesSearchTerms(value: string, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const normalizedValue = normalizeSearchValue(value);
  return terms.every((term) => normalizedValue.includes(term));
}

function documentSearchScore(
  document: PrototypeDocument,
  terms: readonly string[],
  normalizedQuery: string,
): number {
  if (terms.length === 0) return 1;

  const title = getDocumentTitle(document);
  const excerpt = document.excerpt;
  const breadcrumb = getDocumentBreadcrumb(document);
  const content = document.content.join("\n");
  let score = 0;

  if (matchesSearchTerms(content, terms)) score += 12;
  if (
    normalizedQuery.length > 0 &&
    normalizeSearchValue(content).includes(normalizedQuery)
  ) {
    score += 6;
  }
  if (matchesSearchTerms(title, terms)) score += 8;
  if (
    normalizedQuery.length > 0 &&
    normalizeSearchValue(title).includes(normalizedQuery)
  ) {
    score += 4;
  }
  if (matchesSearchTerms(excerpt, terms)) score += 3;
  if (matchesSearchTerms(breadcrumb, terms)) score += 1;

  return score;
}

function getDocumentSearchSnippet(
  document: PrototypeDocument,
  terms: readonly string[],
  normalizedQuery: string,
): string {
  if (terms.length === 0) return "";
  const text = document.content
    .join(" ")
    .replace(/[`*_>#\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  const normalizedText = normalizeSearchValue(text);
  const phraseIndex =
    normalizedQuery.length > 0 ? normalizedText.indexOf(normalizedQuery) : -1;
  const termIndex = terms.reduce((best, term) => {
    const index = normalizedText.indexOf(term);
    if (index < 0) return best;
    return best < 0 ? index : Math.min(best, index);
  }, -1);
  const matchIndex = phraseIndex >= 0 ? phraseIndex : termIndex;
  if (matchIndex < 0) return "";

  const start = Math.max(0, matchIndex - DOCUMENT_SEARCH_SNIPPET_RADIUS);
  const end = Math.min(
    text.length,
    matchIndex + normalizedQuery.length + DOCUMENT_SEARCH_SNIPPET_RADIUS,
  );
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${
    end < text.length ? "…" : ""
  }`;
}
