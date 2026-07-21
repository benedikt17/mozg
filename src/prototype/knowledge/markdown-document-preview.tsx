import React from "react";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import type { PhrasingContent, Table, TableCell } from "mdast";
import { parseMarkdown } from "@/lib/markdown/pipeline";

export type DocumentHeading = {
  id: string;
  label: string;
  level: 1 | 2 | 3;
};

export function getDocumentHeadings(
  document: PrototypeDocument,
): DocumentHeading[] {
  return document.content.flatMap((line, index) => {
    const match = /^(#{1,3})\s+(.+)$/.exec(line);
    if (!match) return [];
    const level = match[1]?.length;
    return [
      {
        id: `document-${document.id}-heading-${index}`,
        label: match[2] ?? line,
        level: level === 3 ? 3 : level === 2 ? 2 : 1,
      } satisfies DocumentHeading,
    ];
  });
}

export function MarkdownDocumentPreview({
  document,
  hideLeadingTitle = false,
  headingIdPrefix = "",
}: {
  document: PrototypeDocument;
  hideLeadingTitle?: boolean;
  headingIdPrefix?: string;
}): React.JSX.Element {
  const headings = getDocumentHeadings(document);
  const blocks: React.ReactNode[] = [];
  const firstContentIndex =
    hideLeadingTitle && document.content[0]?.trim() === `# ${document.title}`
      ? 1
      : 0;
  for (
    let index = firstContentIndex;
    index < document.content.length;
    index += 1
  ) {
    const line = document.content[index] ?? "";
    if (line.startsWith("```")) {
      const code: string[] = [];
      let codeIndex = index + 1;
      while (
        codeIndex < document.content.length &&
        !(document.content[codeIndex] ?? "").startsWith("```")
      ) {
        code.push(document.content[codeIndex] ?? "");
        codeIndex += 1;
      }
      blocks.push(
        <pre className="document-code-block" key={`${document.id}-${index}`}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      index = codeIndex;
      continue;
    }
    const table = getMarkdownTable(document.content, index);
    if (table) {
      blocks.push(
        <MarkdownTable
          key={`${document.id}-table-${index}`}
          table={table.table}
        />,
      );
      index = table.endIndex;
      continue;
    }
    const heading = headings.find(
      (item) => item.id === `document-${document.id}-heading-${index}`,
    );
    blocks.push(
      <MarkdownPreviewBlock
        anchorId={heading ? `${headingIdPrefix}${heading.id}` : undefined}
        key={`${document.id}-${index}`}
        line={line}
      />,
    );
  }
  return <>{blocks}</>;
}

function splitTableRow(line: string): string[] {
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

  const parsed = parseMarkdown(tableLines.join("\n"));
  const table = parsed.children.find(
    (node): node is Table => node.type === "table",
  );
  return table ? { endIndex, table } : null;
}

function MarkdownTable({ table }: { table: Table }): React.JSX.Element {
  const [header, ...body] = table.children;
  return (
    <div className="document-table-scroll">
      <table>
        <thead>
          <tr>
            {header?.children.map((cell, index) => (
              <MarkdownTableCell
                cell={cell}
                header
                key={`header-${index}`}
                style={{ textAlign: table.align?.[index] ?? "left" }}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.children.map((cell, cellIndex) => (
                <MarkdownTableCell
                  cell={cell}
                  key={`${rowIndex}-${cellIndex}`}
                  style={{ textAlign: table.align?.[cellIndex] ?? "left" }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownTableCell({
  cell,
  header = false,
  style,
}: {
  cell: TableCell;
  header?: boolean;
  style: React.CSSProperties;
}): React.JSX.Element {
  const content = renderTableInlineMarkdown(cell.children);
  return header ? (
    <th style={style}>{content}</th>
  ) : (
    <td style={style}>{content}</td>
  );
}

function renderTableInlineMarkdown(
  nodes: PhrasingContent[],
  keyPrefix = "cell",
): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text":
        return node.value;
      case "emphasis":
        return (
          <em key={key}>{renderTableInlineMarkdown(node.children, key)}</em>
        );
      case "strong":
        return (
          <strong key={key}>
            {renderTableInlineMarkdown(node.children, key)}
          </strong>
        );
      case "delete":
        return (
          <del key={key}>{renderTableInlineMarkdown(node.children, key)}</del>
        );
      case "inlineCode":
        return <code key={key}>{node.value}</code>;
      case "link":
        return /^https?:\/\//.test(node.url) ? (
          <a href={node.url} key={key} rel="noreferrer" target="_blank">
            {renderTableInlineMarkdown(node.children, key)}
          </a>
        ) : (
          renderTableInlineMarkdown(node.children, key)
        );
      default:
        return "value" in node
          ? node.value
          : "children" in node
            ? renderTableInlineMarkdown(node.children, key)
            : null;
    }
  });
}

function MarkdownPreviewBlock({
  line,
  anchorId,
}: {
  line: string;
  anchorId?: string;
}): React.JSX.Element {
  if (line === "---") return <hr />;
  if (line.startsWith("# "))
    return <h1 id={anchorId}>{renderInlineMarkdown(line.slice(2))}</h1>;
  if (line.startsWith("## "))
    return <h2 id={anchorId}>{renderInlineMarkdown(line.slice(3))}</h2>;
  if (line.startsWith("### "))
    return <h3 id={anchorId}>{renderInlineMarkdown(line.slice(4))}</h3>;
  const checklist = /^- \[([ x])\]\s+(.+)$/.exec(line);
  if (checklist) {
    return (
      <p className="document-list-item document-checklist-item">
        <input
          aria-label="Состояние пункта"
          checked={checklist[1] === "x"}
          disabled
          type="checkbox"
        />
        <span>{renderInlineMarkdown(checklist[2] ?? "")}</span>
      </p>
    );
  }
  if (line.startsWith("- "))
    return (
      <p className="document-list-item">
        • {renderInlineMarkdown(line.slice(2))}
      </p>
    );
  if (/^\d+\.\s/.test(line))
    return <p className="document-list-item">{renderInlineMarkdown(line)}</p>;
  if (line.startsWith("> "))
    return <blockquote>{renderInlineMarkdown(line.slice(2))}</blockquote>;
  return <p>{renderInlineMarkdown(line)}</p>;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokenPattern =
    /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|\*[^*\n]+\*)/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match = tokenPattern.exec(text);
  while (match) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(token);
      nodes.push(
        link ? (
          <a href={link[2]} key={key} rel="noreferrer" target="_blank">
            {link[1]}
          </a>
        ) : (
          token
        ),
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    cursor = match.index + token.length;
    match = tokenPattern.exec(text);
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
