import "server-only";

import { inflateRawSync } from "node:zlib";

import { getDocumentProxy } from "unpdf";

import type { ProjectFileMimeType } from "./project-file-repository";

export const PROJECT_FILE_SEARCH_EXTRACTOR_VERSION = 1;
export const PROJECT_FILE_SEARCH_CHUNK_MAX_BYTES = 24_000;
export const PROJECT_FILE_SEARCH_MAX_CHUNKS = 512;

const PROJECT_FILE_SEARCH_CHUNK_TARGET_BYTES = 20_000;
const PROJECT_FILE_SEARCH_CHUNK_OVERLAP_CHARS = 512;
const PROJECT_FILE_SEARCH_MAX_PDF_PAGES = 2_000;
const OOXML_MAX_ENTRIES = 10_000;
const OOXML_MAX_RELEVANT_ENTRY_BYTES = 16 * 1024 * 1024;
const OOXML_MAX_RELEVANT_TOTAL_BYTES = 32 * 1024 * 1024;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;

const SEARCHABLE_MIME_TYPES = new Set<ProjectFileMimeType>([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

type ZipEntry = {
  name: string;
  flags: number;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

export function isProjectFileSearchableMimeType(
  mimeType: ProjectFileMimeType,
): boolean {
  return SEARCHABLE_MIME_TYPES.has(mimeType);
}

export function normalizeProjectFileSearchText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\u0000/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkProjectFileSearchText(value: string): string[] {
  const text = normalizeProjectFileSearchText(value);
  if (!text) return [""];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    if (chunks.length >= PROJECT_FILE_SEARCH_MAX_CHUNKS) {
      throw new Error("Project file search text exceeds the indexing limit.");
    }

    let low = start + 1;
    let high = text.length;
    let end = low;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const byteLength = Buffer.byteLength(text.slice(start, middle), "utf8");
      if (byteLength <= PROJECT_FILE_SEARCH_CHUNK_TARGET_BYTES) {
        end = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    if (end < text.length) {
      const minimumBreak = Math.max(start + 1, end - 512);
      const breakAt = Math.max(
        text.lastIndexOf("\n", end),
        text.lastIndexOf(" ", end),
      );
      if (breakAt >= minimumBreak) end = breakAt + 1;
    }

    const chunk = text.slice(start, end).trim();
    if (Buffer.byteLength(chunk, "utf8") > PROJECT_FILE_SEARCH_CHUNK_MAX_BYTES) {
      throw new Error("Project file search chunk exceeds the database limit.");
    }
    chunks.push(chunk);

    if (end >= text.length) break;
    const nextStart = Math.max(start + 1, end - PROJECT_FILE_SEARCH_CHUNK_OVERLAP_CHARS);
    start = nextStart;
  }

  return chunks;
}

export async function extractProjectFileSearchText(
  blob: Blob,
  mimeType: ProjectFileMimeType,
): Promise<string> {
  if (!isProjectFileSearchableMimeType(mimeType)) {
    throw new Error(`Unsupported Project file search MIME type: ${mimeType}`);
  }

  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "application/json"
  ) {
    return normalizeProjectFileSearchText(await blob.text());
  }

  if (mimeType === "application/pdf") {
    return extractPdfText(blob);
  }

  return extractOoxmlText(blob, mimeType);
}

async function extractPdfText(blob: Blob): Promise<string> {
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await getDocumentProxy(data, {
    isEvalSupported: false,
    maxImageSize: 0,
    useSystemFonts: false,
  });

  try {
    if (pdf.numPages > PROJECT_FILE_SEARCH_MAX_PDF_PAGES) {
      throw new Error("PDF exceeds the Project file search page limit.");
    }

    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const parts: string[] = [];
      for (const item of content.items) {
        if (!("str" in item) || typeof item.str !== "string") continue;
        parts.push(item.str);
        if ("hasEOL" in item && item.hasEOL) parts.push("\n");
        else parts.push(" ");
      }
      pages.push(parts.join(""));
      page.cleanup();
    }
    return normalizeProjectFileSearchText(pages.join("\n\n"));
  } finally {
    await pdf.loadingTask.destroy();
  }
}

async function extractOoxmlText(
  blob: Blob,
  mimeType: ProjectFileMimeType,
): Promise<string> {
  const archive = Buffer.from(await blob.arrayBuffer());
  const entries = readZipEntries(archive);
  const relevant = entries.filter((entry) =>
    isRelevantOoxmlEntry(entry.name, mimeType),
  );

  let totalUncompressedBytes = 0;
  const xmlParts: string[] = [];
  for (const entry of relevant) {
    if (entry.uncompressedSize > OOXML_MAX_RELEVANT_ENTRY_BYTES) {
      throw new Error("Office document XML entry exceeds the search extraction limit.");
    }
    totalUncompressedBytes += entry.uncompressedSize;
    if (totalUncompressedBytes > OOXML_MAX_RELEVANT_TOTAL_BYTES) {
      throw new Error("Office document exceeds the search extraction limit.");
    }
    const xml = readZipEntry(archive, entry);
    xmlParts.push(xmlToSearchText(decodeXml(xml)));
  }

  return normalizeProjectFileSearchText(xmlParts.join("\n"));
}

function readZipEntries(archive: Buffer): ZipEntry[] {
  const eocdOffset = findZipEocd(archive);
  const diskNumber = archive.readUInt16LE(eocdOffset + 4);
  const centralDisk = archive.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = archive.readUInt16LE(eocdOffset + 8);
  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  const centralSize = archive.readUInt32LE(eocdOffset + 12);
  const centralOffset = archive.readUInt32LE(eocdOffset + 16);

  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    throw new Error("Unsupported multi-disk or ZIP64 Office document.");
  }
  if (entryCount > OOXML_MAX_ENTRIES) {
    throw new Error("Office document contains too many ZIP entries.");
  }
  if (centralOffset + centralSize > archive.length) {
    throw new Error("Office document ZIP central directory is invalid.");
  }

  const entries: ZipEntry[] = [];
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > archive.length ||
      archive.readUInt32LE(offset) !== ZIP_CENTRAL_SIGNATURE
    ) {
      throw new Error("Office document ZIP central directory is invalid.");
    }
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localHeaderOffset = archive.readUInt32LE(offset + 42);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > archive.length) {
      throw new Error("Office document ZIP entry is truncated.");
    }
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    entries.push({
      name,
      flags,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset = next;
  }
  return entries;
}

function findZipEocd(archive: Buffer): number {
  const minimumOffset = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset;
  }
  throw new Error("Office document ZIP end record was not found.");
}

function readZipEntry(archive: Buffer, entry: ZipEntry): Buffer {
  if ((entry.flags & 0x1) !== 0) {
    throw new Error("Encrypted Office documents are not searchable.");
  }
  const offset = entry.localHeaderOffset;
  if (
    offset + 30 > archive.length ||
    archive.readUInt32LE(offset) !== ZIP_LOCAL_SIGNATURE
  ) {
    throw new Error("Office document ZIP local header is invalid.");
  }
  const nameLength = archive.readUInt16LE(offset + 26);
  const extraLength = archive.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > archive.length) {
    throw new Error("Office document ZIP entry data is truncated.");
  }
  const compressed = archive.subarray(dataStart, dataEnd);

  let output: Buffer;
  if (entry.method === 0) {
    output = Buffer.from(compressed);
  } else if (entry.method === 8) {
    output = inflateRawSync(compressed, {
      maxOutputLength: OOXML_MAX_RELEVANT_ENTRY_BYTES,
    });
  } else {
    throw new Error(`Unsupported Office document ZIP compression: ${entry.method}`);
  }

  if (
    output.length !== entry.uncompressedSize ||
    output.length > OOXML_MAX_RELEVANT_ENTRY_BYTES
  ) {
    throw new Error("Office document ZIP entry size is invalid.");
  }
  return output;
}

function isRelevantOoxmlEntry(
  name: string,
  mimeType: ProjectFileMimeType,
): boolean {
  const normalized = name.replaceAll("\\", "/");
  if (!normalized.endsWith(".xml")) return false;

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return /^word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/.test(
      normalized,
    );
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return /^(xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml|xl\/comments\d+\.xml)$/.test(
      normalized,
    );
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return /^(ppt\/slides\/slide\d+\.xml|ppt\/notesSlides\/notesSlide\d+\.xml|ppt\/comments\/comment\d+\.xml)$/.test(
      normalized,
    );
  }
  return false;
}

function decodeXml(value: Buffer): string {
  if (value.length >= 2 && value[0] === 0xff && value[1] === 0xfe) {
    return value.subarray(2).toString("utf16le");
  }
  if (value.length >= 2 && value[0] === 0xfe && value[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(value.length - 2);
    for (let index = 2; index + 1 < value.length; index += 2) {
      swapped[index - 2] = value[index + 1];
      swapped[index - 1] = value[index];
    }
    return swapped.toString("utf16le");
  }
  return value.toString("utf8").replace(/^\uFEFF/, "");
}

function xmlToSearchText(xml: string): string {
  return decodeXmlEntities(
    xml
      .replace(/<(w:tab|a:tab|tab)\b[^>]*\/>/gi, "\t")
      .replace(/<\/(w:p|a:p|row|si|c)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function decodeXmlEntities(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|amp|lt|gt|quot|apos);/gi,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      switch (entity.toLowerCase()) {
        case "&amp;":
          return "&";
        case "&lt;":
          return "<";
        case "&gt;":
          return ">";
        case "&quot;":
          return '"';
        case "&apos;":
          return "'";
        default:
          return " ";
      }
    },
  );
}
