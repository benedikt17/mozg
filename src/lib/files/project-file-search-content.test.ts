import { describe, expect, it } from "vitest";

import {
  chunkProjectFileSearchText,
  extractProjectFileSearchText,
  isProjectFileSearchableMimeType,
  normalizeProjectFileSearchText,
  PROJECT_FILE_SEARCH_CHUNK_MAX_BYTES,
} from "./project-file-search-content.server";

import type { ProjectFileMimeType } from "./project-file-repository";

function createStoredZip(entries: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const local = Buffer.alloc(30 + name.length + content.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    content.copy(local, 30 + name.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const localDirectory = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localDirectory.length, 16);
  return Buffer.concat([localDirectory, centralDirectory, eocd]);
}

function officeBlob(
  mimeType: ProjectFileMimeType,
  entries: Array<{ name: string; content: string }>,
): Blob {
  return new Blob([createStoredZip(entries)], { type: mimeType });
}

describe("Project file content search extraction", () => {
  it("recognizes searchable document MIME types without treating images as text", () => {
    expect(isProjectFileSearchableMimeType("text/markdown")).toBe(true);
    expect(isProjectFileSearchableMimeType("application/pdf")).toBe(true);
    expect(
      isProjectFileSearchableMimeType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
    expect(isProjectFileSearchableMimeType("image/png")).toBe(false);
  });

  it("normalizes line endings and repeated whitespace", () => {
    expect(normalizeProjectFileSearchText("  Один\r\n\tдва   три\n\n\nчетыре  ")).toBe(
      "Один\nдва три\n\nчетыре",
    );
  });

  it("keeps chunks within the database byte limit and overlaps boundaries", () => {
    const marker = "уникальная фраза на границе";
    const text = `${"начало ".repeat(3_000)}${marker}${" конец".repeat(3_000)}`;
    const chunks = chunkProjectFileSearchText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(
      chunks.every(
        (chunk) => Buffer.byteLength(chunk, "utf8") <= PROJECT_FILE_SEARCH_CHUNK_MAX_BYTES,
      ),
    ).toBe(true);
    expect(chunks.some((chunk) => chunk.includes(marker))).toBe(true);
    for (let index = 1; index < chunks.length; index += 1) {
      expect(chunks[index - 1]?.slice(-120)).toContain(
        chunks[index]?.slice(0, 120).trim().slice(0, 24),
      );
    }
  });

  it("uses one empty sentinel chunk for documents with no extractable text", () => {
    expect(chunkProjectFileSearchText(" \n\t ")).toEqual([""]);
  });

  it("extracts text from plain text documents", async () => {
    const text = await extractProjectFileSearchText(
      new Blob(["Кощей   ищет\nархитектуру приложения"], { type: "text/plain" }),
      "text/plain",
    );
    expect(text).toBe("Кощей ищет\nархитектуру приложения");
  });

  it("extracts DOCX text from relevant Word XML only", async () => {
    const mimeType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const blob = officeBlob(mimeType, [
      {
        name: "word/document.xml",
        content:
          '<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Архитектура приложения</w:t></w:r></w:p><w:p><w:r><w:t>Кощей &amp; Яга</w:t></w:r></w:p></w:body></w:document>',
      },
      { name: "docProps/core.xml", content: "<root>СЕКРЕТНЫЕ МЕТАДАННЫЕ</root>" },
    ]);

    const text = await extractProjectFileSearchText(blob, mimeType);
    expect(text).toContain("Архитектура приложения");
    expect(text).toContain("Кощей & Яга");
    expect(text).not.toContain("СЕКРЕТНЫЕ МЕТАДАННЫЕ");
  });

  it("extracts shared strings and worksheet XML from XLSX", async () => {
    const mimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const blob = officeBlob(mimeType, [
      {
        name: "xl/sharedStrings.xml",
        content: '<sst><si><t>Поиск по содержимому</t></si></sst>',
      },
      {
        name: "xl/worksheets/sheet1.xml",
        content: '<worksheet><sheetData><row><c><v>42</v></c></row></sheetData></worksheet>',
      },
    ]);

    const text = await extractProjectFileSearchText(blob, mimeType);
    expect(text).toContain("Поиск по содержимому");
    expect(text).toContain("42");
  });

  it("extracts slide and notes text from PPTX", async () => {
    const mimeType =
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const blob = officeBlob(mimeType, [
      {
        name: "ppt/slides/slide1.xml",
        content: '<p:sld><a:p><a:r><a:t>Фраза на слайде</a:t></a:r></a:p></p:sld>',
      },
      {
        name: "ppt/notesSlides/notesSlide1.xml",
        content: '<p:notes><a:p><a:r><a:t>Заметка докладчика</a:t></a:r></a:p></p:notes>',
      },
    ]);

    const text = await extractProjectFileSearchText(blob, mimeType);
    expect(text).toContain("Фраза на слайде");
    expect(text).toContain("Заметка докладчика");
  });
});
