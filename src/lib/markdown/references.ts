import type { ParsedTaskReference, ParsedWikiLink } from "@/lib/markdown/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TASK_MARKER_PATTERN = /\^task-\S+/g;
const FINAL_TASK_MARKER_PATTERN =
  /^(.*?)\s+\^task-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i;
const TASK_LIST_ITEM_PATTERN = /^\s*[-+*]\s+\[([ xX])\]\s+(.+)$/;

type ScannableLine = {
  line: string;
  lineNumber: number;
  offset: number;
};

function getScannableLines(markdown: string): ScannableLine[] {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const result: ScannableLine[] = [];
  let fenceCharacter: "`" | "~" | null = null;
  let fenceLength = 0;
  let offset = 0;

  lines.forEach((line, index) => {
    if (fenceCharacter) {
      const closing = line.match(/^ {0,3}(`+|~+)\s*$/);
      if (
        closing &&
        closing[1][0] === fenceCharacter &&
        closing[1].length >= fenceLength
      ) {
        fenceCharacter = null;
        fenceLength = 0;
      }
    } else {
      const opening = line.match(/^ {0,3}(`{3,}|~{3,}).*$/);
      if (opening) {
        fenceCharacter = opening[1][0] as "`" | "~";
        fenceLength = opening[1].length;
      } else {
        result.push({ line, lineNumber: index + 1, offset });
      }
    }

    offset += line.length + 1;
  });

  return result;
}

function isEscaped(value: string, index: number): boolean {
  let backslashes = 0;
  for (
    let cursor = index - 1;
    cursor >= 0 && value[cursor] === "\\";
    cursor -= 1
  ) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function inlineCodeMask(line: string): boolean[] {
  const mask = Array.from({ length: line.length }, () => false);
  let delimiterLength = 0;
  let cursor = 0;

  while (cursor < line.length) {
    if (line[cursor] !== "`") {
      if (delimiterLength > 0) mask[cursor] = true;
      cursor += 1;
      continue;
    }

    let runLength = 1;
    while (line[cursor + runLength] === "`") runLength += 1;

    if (delimiterLength === 0) {
      delimiterLength = runLength;
      for (let index = cursor; index < cursor + runLength; index += 1)
        mask[index] = true;
    } else if (runLength === delimiterLength) {
      for (let index = cursor; index < cursor + runLength; index += 1)
        mask[index] = true;
      delimiterLength = 0;
    } else {
      for (let index = cursor; index < cursor + runLength; index += 1)
        mask[index] = true;
    }

    cursor += runLength;
  }

  return mask;
}

export function extractTaskReferences(markdown: string): ParsedTaskReference[] {
  const provisional: Omit<ParsedTaskReference, "isDuplicate">[] = [];
  const occurrences = new Map<string, number>();

  for (const { line, lineNumber } of getScannableLines(markdown)) {
    const taskItem = line.match(TASK_LIST_ITEM_PATTERN);
    if (!taskItem) continue;

    const body = taskItem[2];
    const markers = body.match(TASK_MARKER_PATTERN) ?? [];
    if (markers.length !== 1) continue;

    const finalMarker = body.match(FINAL_TASK_MARKER_PATTERN);
    if (!finalMarker || !UUID_PATTERN.test(finalMarker[2])) continue;

    const title = finalMarker[1].trim();
    if (!title) continue;

    const id = finalMarker[2].toLowerCase();
    const occurrence = (occurrences.get(id) ?? 0) + 1;
    occurrences.set(id, occurrence);
    provisional.push({
      id,
      title,
      checkedMarker: taskItem[1].toLowerCase() === "x",
      lineOrPosition: lineNumber,
      occurrence,
    });
  }

  return provisional.map((reference) => ({
    ...reference,
    isDuplicate: (occurrences.get(reference.id) ?? 0) > 1,
  }));
}

export function extractWikiLinks(markdown: string): ParsedWikiLink[] {
  const references: ParsedWikiLink[] = [];

  for (const { line, lineNumber, offset } of getScannableLines(markdown)) {
    const codeMask = inlineCodeMask(line);
    let cursor = 0;

    while (cursor < line.length - 1) {
      if (
        line[cursor] !== "[" ||
        line[cursor + 1] !== "[" ||
        codeMask[cursor] ||
        isEscaped(line, cursor)
      ) {
        cursor += 1;
        continue;
      }

      const closing = line.indexOf("]]", cursor + 2);
      if (closing < 0) break;

      const value = line.slice(cursor + 2, closing);
      const title = value.trim();
      if (title && !value.includes("[") && !value.includes("]")) {
        const raw = line.slice(cursor, closing + 2);
        references.push({
          title,
          raw,
          lineOrPosition: lineNumber,
          start: offset + cursor,
          end: offset + closing + 2,
        });
      }

      cursor = closing + 2;
    }
  }

  return references;
}
