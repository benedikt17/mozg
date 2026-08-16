import { describe, expect, it } from "vitest";
import {
  createKnowledgeBackup,
  createKnowledgeBackupEntries,
  knowledgeBackupFileName,
  type KnowledgeBackupSource,
} from "@/prototype/knowledge/knowledge-backup-export";

function backupSource(): KnowledgeBackupSource {
  return {
    projects: [
      {
        description: "",
        id: "project-a",
        name: "Проект: A",
        shortName: "A",
      },
    ],
    knowledgeFolders: [
      { id: "folder-one", path: ["Папка/Одна"], projectId: "project-a" },
      { id: "folder-empty", path: ["Пустая"], projectId: "project-a" },
    ],
    documents: [
      {
        backlinks: [],
        content: ["# Первая", "", "Текст"],
        excerpt: "",
        folder: "Папка/Одна",
        folderPath: ["Папка/Одна"],
        id: "doc-1",
        projectId: "project-a",
        title: "CON",
      },
      {
        backlinks: [],
        content: ["# Вторая"],
        excerpt: "",
        folder: "Папка/Одна",
        folderPath: ["Папка/Одна"],
        id: "doc-2",
        projectId: "project-a",
        title: "CON",
      },
      {
        backlinks: [],
        content: ["Удалённый текст"],
        deletedAt: "2026-08-15T12:00:00.000Z",
        excerpt: "",
        folder: "Корзина?",
        folderPath: ["Корзина?"],
        id: "doc-trash",
        projectId: "project-a",
        title: "Удалённая*",
      },
    ],
  };
}

describe("Knowledge backup export", () => {
  it("preserves folder structure, empty folders, Trash and duplicate Markdown names", () => {
    const generatedAt = new Date("2026-08-16T06:00:00.000Z");
    const { entries, manifest } = createKnowledgeBackupEntries(
      backupSource(),
      generatedAt,
    );
    const paths = entries.map((entry) => entry.path);

    expect(paths).toContain("Проект- A/");
    expect(paths).toContain("Проект- A/Папка-Одна/");
    expect(paths).toContain("Проект- A/Пустая/");
    expect(paths).toContain("Проект- A/Папка-Одна/_CON.md");
    expect(paths).toContain("Проект- A/Папка-Одна/_CON (2).md");
    expect(paths).toContain("_Корзина/Проект- A/Корзина-/Удалённая-.md");

    expect(
      entries.find((entry) => entry.path === "Проект- A/Папка-Одна/_CON.md")
        ?.content,
    ).toBe("# Первая\n\nТекст");
    expect(manifest).toMatchObject({
      activeDocumentCount: 2,
      deletedDocumentCount: 1,
      documentCount: 3,
      format: "mozg-knowledge-backup",
      generatedAt: generatedAt.toISOString(),
      projectCount: 1,
      version: 1,
    });
    expect(manifest.documents.map((document) => document.documentId)).toEqual([
      "doc-1",
      "doc-2",
      "doc-trash",
    ]);
    expect(JSON.parse(entries[0]?.content ?? "{}")).toEqual(manifest);
  });

  it("builds a valid uncompressed UTF-8 ZIP with a stable daily filename", () => {
    const generatedAt = new Date("2026-08-16T23:59:59.000Z");
    const archive = createKnowledgeBackup(backupSource(), generatedAt);
    const view = new DataView(
      archive.bytes.buffer,
      archive.bytes.byteOffset,
      archive.bytes.byteLength,
    );

    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(archive.bytes.byteLength - 22, true)).toBe(
      0x06054b50,
    );
    expect(archive.fileName).toBe("MOZG-Knowledge-Backup-2026-08-16.zip");
    expect(knowledgeBackupFileName(generatedAt)).toBe(archive.fileName);

    const files = readStoredZipFiles(archive.bytes);
    expect(files.get("manifest.json")).toContain(
      '"format": "mozg-knowledge-backup"',
    );
    expect(files.get("Проект- A/Папка-Одна/_CON.md")).toBe("# Первая\n\nТекст");
    expect(files.get("_Корзина/Проект- A/Корзина-/Удалённая-.md")).toBe(
      "Удалённый текст",
    );
  });
});

function readStoredZipFiles(bytes: Uint8Array): Map<string, string> {
  const files = new Map<string, string>();
  const decoder = new TextDecoder();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  while (offset + 30 <= bytes.byteLength) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    expect(compression).toBe(0);

    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = decoder.decode(bytes.subarray(nameStart, nameEnd));
    if (!name.endsWith("/")) {
      files.set(name, decoder.decode(bytes.subarray(dataStart, dataEnd)));
    }
    offset = dataEnd;
  }

  return files;
}
