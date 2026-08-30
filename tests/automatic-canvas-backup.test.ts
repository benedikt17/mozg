import { describe, expect, it } from "vitest";
import { createAutomaticCanvasBackupBundle } from "@/lib/knowledge-backup/automatic-canvas-backup";

describe("automatic Canvas backup bundle", () => {
  it("adds portable canvases, linked articles and metadata-only files below the Canvas directory", () => {
    const bundle = createAutomaticCanvasBackupBundle(
      {
        canvases: [
          {
            document: {
              schemaVersion: 2,
              nodes: [
                {
                  id: "article-node",
                  kind: "article",
                  articleId: "article-yaga",
                  lastKnownTitle: "Легенда",
                  position: { x: 0, y: 0 },
                  size: { width: 180, height: 100 },
                  zIndex: 1,
                },
                {
                  id: "file-node",
                  kind: "pdf",
                  fileId: "file-1",
                  lastKnownName: "Яга.pdf",
                  position: { x: 240, y: 0 },
                  size: { width: 180, height: 100 },
                  zIndex: 2,
                },
              ],
              edges: [],
            },
            groupId: "group-yaga",
            id: "canvas-yaga",
            projectId: "project-1",
            revision: 9,
            title: "Яга",
          },
        ],
        documents: [
          {
            backlinks: [],
            content: ["Текст легенды"],
            excerpt: "",
            folder: "",
            id: "article-yaga",
            projectId: "project-1",
            title: "Легенда",
          },
        ],
        files: [
          {
            byteSize: 512,
            checksum: "sha256:test",
            id: "file-1",
            mimeType: "application/pdf",
            name: "Яга.pdf",
            originalName: "Яга.pdf",
          },
        ],
        groups: [
          {
            id: "group-yaga",
            parentGroupId: null,
            projectId: "project-1",
            title: "Территории сюжетов",
          },
        ],
        projects: [{ id: "project-1", name: "Лукоморье" }],
      },
      new Date("2026-08-30T12:00:00.000Z"),
    );

    expect(bundle.canvases).toMatchObject([
      {
        canvasId: "canvas-yaga",
        nodeCount: 2,
        path: "Холсты/Лукоморье/Территории сюжетов/Яга",
        revision: 9,
      },
    ]);
    const entries = new Map(bundle.entries.map((entry) => [entry.path, entry.content]));
    expect(entries.get("Холсты/Лукоморье/Территории сюжетов/Яга/canvas.json")).toContain(
      '"schemaVersion": 2',
    );
    expect(entries.get("Холсты/Лукоморье/Территории сюжетов/Яга/articles/Легенда-article-yaga.md")).toContain(
      "Текст легенды",
    );
    expect(entries.get("Холсты/Лукоморье/Территории сюжетов/Яга/index.html")).toContain(
      "файл не вложен",
    );
  });
});
