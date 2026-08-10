from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one exact match, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


knowledge_state = "src/prototype/state/knowledge-state.ts"
replace_once(
    knowledge_state,
    'import type { PrototypeDocument } from "@/prototype/desktop-mock-data";\nimport type {',
    'import type { PrototypeDocument } from "@/prototype/desktop-mock-data";\nimport { getFirstMarkdownHeading } from "@/lib/markdown";\nimport type {',
)
replace_once(
    knowledge_state,
    '''function getFirstMarkdownHeading(markdown: string): string | undefined {
  for (const line of markdown.split("\\n")) {
    const match = line.match(/^\\s{0,3}#{1,6}\\s+(.+?)\\s*#*\\s*$/);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

''',
    "",
)
replace_once(
    knowledge_state,
    '  return getFirstMarkdownHeading(document.content.join("\\n")) ?? document.title;',
    '  return (\n    getFirstMarkdownHeading(document.content.join("\\n"))?.text ?? document.title\n  );',
)

preview = "src/prototype/knowledge/markdown-document-preview.tsx"
replace_once(
    preview,
    'import type { PhrasingContent, Table, TableCell } from "mdast";\nimport { parseMarkdown } from "@/lib/markdown/pipeline";',
    'import type { PhrasingContent, Table, TableCell } from "mdast";\nimport {\n  analyzeMarkdownStructure,\n  type MarkdownHeadingStructure,\n} from "@/lib/markdown";',
)
replace_once(
    preview,
    '''function getMarkdownHeadings(
  documentId: string,
  lines: string[],
): DocumentHeading[] {
  return lines.flatMap((line, index) => {
    const match = /^(#{1,3})\\s+(.+)$/.exec(line);
    if (!match) return [];
    const level = match[1]?.length;
    return [
      {
        id: `document-${documentId}-heading-${index}`,
        label: match[2] ?? line,
        level: level === 3 ? 3 : level === 2 ? 2 : 1,
      } satisfies DocumentHeading,
    ];
  });
}
''',
    '''function toDocumentHeadings(
  documentId: string,
  headings: MarkdownHeadingStructure[],
): DocumentHeading[] {
  return headings
    .filter((heading) => heading.depth <= 3)
    .map((heading) => ({
      id: `document-${documentId}-heading-${heading.startLineIndex}`,
      label: heading.text,
      level: heading.depth === 3 ? 3 : heading.depth === 2 ? 2 : 1,
    }));
}

function getMarkdownHeadings(
  documentId: string,
  lines: string[],
): DocumentHeading[] {
  return toDocumentHeadings(
    documentId,
    analyzeMarkdownStructure(lines.join("\\n")).headings,
  );
}
''',
)
replace_once(
    preview,
    '  const headings = getMarkdownHeadings(contentId, lines);\n  const blocks: React.ReactNode[] = [];',
    '  const structure = analyzeMarkdownStructure(lines.join("\\n"));\n  const headings = toDocumentHeadings(contentId, structure.headings);\n  const tablesByStartLine = new Map(\n    structure.tables.map((table) => [table.startLineIndex, table]),\n  );\n  const blocks: React.ReactNode[] = [];',
)
replace_once(
    preview,
    '''    const table = getMarkdownTable(lines, index);
    if (table) {
      blocks.push(
        <MarkdownTable
          key={`${contentId}-table-${index}`}
          table={table.table}
        />,
      );
      index = table.endIndex;
      continue;
    }
''',
    '''    const table = tablesByStartLine.get(index);
    if (table) {
      blocks.push(
        <MarkdownTable
          key={`${contentId}-table-${index}`}
          table={table.table}
        />,
      );
      index = table.endLineIndex;
      continue;
    }
''',
)
replace_once(
    preview,
    '''function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const withoutOuterPipes = trimmed.startsWith("|")
    ? trimmed.slice(1)
    : trimmed;
  const normalized = withoutOuterPipes.endsWith("|")
    ? withoutOuterPipes.slice(0, -1)
    : withoutOuterPipes;
  return normalized.split("|").map((cell) => cell.trim());
}

function isTableDelimiter(line: string): boolean {
  const cells = splitTableRow(line);
  return (
    cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
  );
}

function getMarkdownTable(
  lines: string[],
  startIndex: number,
): { endIndex: number; table: Table } | null {
  const header = lines[startIndex];
  const delimiter = lines[startIndex + 1];
  if (
    !header ||
    !delimiter ||
    !header.includes("|") ||
    !isTableDelimiter(delimiter)
  ) {
    return null;
  }

  const tableLines = [header, delimiter];
  let endIndex = startIndex + 1;
  while (endIndex + 1 < lines.length) {
    const row = lines[endIndex + 1];
    if (!row?.trim() || !row.includes("|")) break;
    tableLines.push(row);
    endIndex += 1;
  }

  const parsed = parseMarkdown(tableLines.join("\\n"));
  const table = parsed.children.find(
    (node): node is Table => node.type === "table",
  );
  return table ? { endIndex, table } : null;
}

''',
    "",
)
