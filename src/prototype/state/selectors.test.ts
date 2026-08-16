import { describe, expect, it } from "vitest";

import type {
  PrototypeDocument,
  PrototypeProject,
} from "@/prototype/desktop-mock-data";
import { getCommandResults } from "./selectors";

const projects: PrototypeProject[] = [
  {
    id: "project-a",
    name: "Проект A",
    shortName: "A",
    description: "",
  },
  {
    id: "project-b",
    name: "Проект B",
    shortName: "B",
    description: "",
  },
];

function document(
  id: string,
  projectId: string,
  title: string,
  content: string,
  excerpt = "",
): PrototypeDocument {
  return {
    id,
    projectId,
    folder: "Материалы",
    folderPath: ["Материалы"],
    title,
    excerpt,
    content: [content],
    backlinks: [],
  };
}

function searchState(documents: PrototypeDocument[]) {
  return {
    activeProjectId: "project-a",
    projects,
    tasks: [],
    documents,
    inboxItems: [],
  };
}

describe("global Knowledge search", () => {
  it("finds a phrase in the article body even when title, excerpt and path do not contain it", () => {
    const results = getCommandResults(
      searchState([
        document(
          "body-match",
          "project-a",
          "Нейтральный заголовок",
          "Внутри статьи Кощей обсуждает архитектуру поискового индекса.",
          "Короткое описание без искомых слов.",
        ),
      ]),
      "архитектуру поискового индекса",
    );

    expect(results).toEqual([
      expect.objectContaining({
        kind: "document",
        id: "body-match",
        title: "Нейтральный заголовок",
      }),
    ]);
    expect(results[0]?.subtitle).toContain("архитектуру поискового индекса");
  });

  it("never leaks matching articles from another Project", () => {
    const results = getCommandResults(
      searchState([
        document(
          "current-project",
          "project-a",
          "Текущий",
          "Общий уникальный маркер находится здесь.",
        ),
        document(
          "other-project",
          "project-b",
          "Чужой",
          "Общий уникальный маркер находится и здесь.",
        ),
      ]),
      "общий уникальный маркер",
    );

    expect(
      results.filter((result) => result.kind === "document").map((result) => result.id),
    ).toEqual(["current-project"]);
  });

  it("keeps title matching as a secondary document-search path", () => {
    const results = getCommandResults(
      searchState([
        document(
          "title-only",
          "project-a",
          "Регистрация товарного знака",
          "Внутри нет искомой формулировки.",
        ),
      ]),
      "товарного знака",
    );

    expect(results[0]).toEqual(
      expect.objectContaining({ kind: "document", id: "title-only" }),
    );
  });

  it("returns every matching article instead of truncating document results at ten", () => {
    const documents = Array.from({ length: 14 }, (_, index) =>
      document(
        `document-${index}`,
        "project-a",
        `Статья ${index}`,
        `Текст статьи содержит общий маркер номер ${index}.`,
      ),
    );

    const results = getCommandResults(searchState(documents), "общий маркер");
    const documentResults = results.filter(
      (result) => result.kind === "document",
    );

    expect(documentResults).toHaveLength(14);
  });

  it("ranks body matches ahead of title-only matches", () => {
    const results = getCommandResults(
      searchState([
        document(
          "title-only",
          "project-a",
          "Архитектура поиска",
          "Никаких совпадений внутри.",
        ),
        document(
          "body-match",
          "project-a",
          "Рабочие заметки",
          "Здесь подробно описана архитектура поиска и её ограничения.",
        ),
      ]),
      "архитектура поиска",
    );

    expect(
      results.filter((result) => result.kind === "document").map((result) => result.id),
    ).toEqual(["body-match", "title-only"]);
  });
});
