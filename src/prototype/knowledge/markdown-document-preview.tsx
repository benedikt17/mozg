import React, { useState } from "react";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import type { PhrasingContent, Table, TableCell } from "mdast";
import {
  analyzeMarkdownStructure,
  type MarkdownHeadingStructure,
} from "@/lib/markdown";
import { UiIcon } from "@/prototype/desktop-icons";

export type DocumentHeading = {
  id: string;
  label: string;
  level: 1 | 2 | 3;
};

export type ExternalLinkToken = {
  label: string;
  href: string;
  trailing: string;
};

export type TaskListToken = { checked: boolean; text: string };
export type NestedListItem = {
  depth: 0 | 1 | 2;
  kind: "task" | "bullet" | "ordered";
  marker: string;
  text: string;
  checked?: boolean;
};
export type NestedListNode = NestedListItem & {
  lineIndex: number;
  children: NestedListNode[];
};

export type MarkdownTaskListMode = "interactive" | "static";

export function getMarkdownTaskListPresentation(
  line: string,
  mode: MarkdownTaskListMode,
): "interactive" | "literal" | null {
  const item = parseNestedListItem(line);
  if (item?.kind !== "task") return null;
  return mode === "static" ? "literal" : "interactive";
}

type DocumentCollapseState = {
  documentId: string;
  collapsed: Set<number>;
};

export function parseNestedListItem(line: string): NestedListItem | null {
  const match = /^( *)(- \[([ xX])\]|- |• |\d+\. )(.*)$/.exec(line);
  if (!match) return null;
  const depth = Math.min(2, Math.floor(match[1]!.length / 4)) as 0 | 1 | 2;
  const marker = match[2]!;
  return {
    depth,
    kind: marker.startsWith("- [")
      ? "task"
      : marker === "- " || marker === "• "
        ? "bullet"
        : "ordered",
    marker,
    text: match[4]!,
    checked: marker.startsWith("- [")
      ? match[3]!.toLowerCase() === "x"
      : undefined,
  };
}

export function buildNestedListTree(
  lines: string[],
  startIndex: number,
): { roots: NestedListNode[]; nextIndex: number } {
  const roots: NestedListNode[] = [];
  const stack: NestedListNode[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const parsed = parseNestedListItem(lines[index] ?? "");
    if (!parsed) break;
    const node: NestedListNode = { ...parsed, lineIndex: index, children: [] };
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= node.depth)
      stack.pop();
    const parent = stack.at(-1);
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
    index += 1;
  }
  return { roots, nextIndex: index };
}

export function parseTaskListToken(line: string): TaskListToken | null {
  const match = /^(?: {0,8})- \[([ xX])\](\s+)(.*)$/.exec(line);
  return match
    ? {
        checked: match[1]!.toLowerCase() === "x",
        text: `${match[2]}${match[3]}`,
      }
    : null;
}

export function toggleTaskListMarker(
  markdown: string,
  lineIndex: number,
  checked: boolean,
): string {
  const lines = markdown.split("\n");
  const line = lines[lineIndex];
  if (line === undefined || !parseTaskListToken(line)) return markdown;
  lines[lineIndex] = line.replace(
    /^(\s*- \[)[ xX](\])/,
    `$1${checked ? "x" : " "}$2`,
  );
  return lines.join("\n");
}

export function parseInternalLinkToken(
  token: string,
): { documentId: string; label: string } | null {
  const match = /^\[\[doc:([^|\]]+)\|([^\]]+)\]\]$/.exec(token);
  return match ? { documentId: match[1]!, label: match[2]! } : null;
}

export function parseExternalLinkToken(
  token: string,
): ExternalLinkToken | null {
  const markdown = /^\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
  if (markdown) {
    return { label: markdown[1]!, href: markdown[2]!, trailing: "" };
  }
  if (!/^https?:\/\//.test(token)) return null;
  const href = token.replace(/[.,!?;:]+$/, "");
  return { label: href, href, trailing: token.slice(href.length) };
}

export function getDocumentHeadings(
  document: PrototypeDocument,
): DocumentHeading[] {
  return getMarkdownHeadings(document.id, document.content);
}

function toDocumentHeadings(
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
    analyzeMarkdownStructure(lines.join("\n")).headings,
  );
}

export function MarkdownDocumentPreview({
  document,
  hideLeadingTitle = false,
  headingIdPrefix = "",
  onInternalLink,
  onTaskToggle,
}: {
  document: PrototypeDocument;
  hideLeadingTitle?: boolean;
  headingIdPrefix?: string;
  onInternalLink?: (documentId: string) => void;
  onTaskToggle?: (lineIndex: number, checked: boolean) => void;
}): React.JSX.Element {
  return (
    <MarkdownContentPreview
      contentId={document.id}
      headingIdPrefix={headingIdPrefix}
      hideLeadingTitle={hideLeadingTitle}
      lines={document.content}
      onInternalLink={onInternalLink}
      onTaskToggle={onTaskToggle}
      title={document.title}
    />
  );
}

export function MarkdownStringPreview({
  contentId,
  markdown,
}: {
  contentId: string;
  markdown: string;
}): React.JSX.Element {
  return (
    <MarkdownContentPreview
      contentId={contentId}
      lines={markdown.split("\n")}
      taskListMode="static"
    />
  );
}

function MarkdownContentPreview({
  contentId,
  headingIdPrefix = "",
  hideLeadingTitle = false,
  lines,
  onInternalLink,
  onTaskToggle,
  taskListMode = "interactive",
  title = "",
}: {
  contentId: string;
  headingIdPrefix?: string;
  hideLeadingTitle?: boolean;
  lines: string[];
  onInternalLink?: (documentId: string) => void;
  onTaskToggle?: (lineIndex: number, checked: boolean) => void;
  taskListMode?: MarkdownTaskListMode;
  title?: string;
}): React.JSX.Element {
  const [collapseState, setCollapseState] = useState<DocumentCollapseState>({
    documentId: contentId,
    collapsed: new Set(),
  });
  const collapsed =
    collapseState.documentId === contentId
      ? collapseState.collapsed
      : new Set<number>();
  const setCollapsed: React.Dispatch<React.SetStateAction<Set<number>>> = (
    update,
  ) => {
    setCollapseState((current) => {
      const currentCollapsed =
        current.documentId === contentId
          ? current.collapsed
          : new Set<number>();
      const nextCollapsed =
        typeof update === "function" ? update(currentCollapsed) : update;
      return { documentId: contentId, collapsed: nextCollapsed };
    });
  };
  const structure = analyzeMarkdownStructure(lines.join("\n"));
  const headings = toDocumentHeadings(contentId, structure.headings);
  const tablesByStartLine = new Map(
    structure.tables.map((table) => [table.startLineIndex, table]),
  );
  const blocks: React.ReactNode[] = [];
  const firstContentIndex =
    hideLeadingTitle && lines[0]?.trim() === `# ${title}` ? 1 : 0;
  for (let index = firstContentIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const listItem = parseNestedListItem(line);
    if (listItem) {
      const tree = buildNestedListTree(lines, index);
      blocks.push(
        <div className="document-list-group" key={`${contentId}-list-${index}`}>
          {tree.roots.map((node) =>
            renderNestedListNode(node, {
              anchorId: undefined,
              collapsed,
              documentId: contentId,
              headingIdPrefix,
              onInternalLink,
              onTaskToggle,
              taskListMode,
              setCollapsed,
            }),
          )}
        </div>,
      );
      index = tree.nextIndex - 1;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      let codeIndex = index + 1;
      while (
        codeIndex < lines.length &&
        !(lines[codeIndex] ?? "").startsWith("```")
      ) {
        code.push(lines[codeIndex] ?? "");
        codeIndex += 1;
      }
      blocks.push(
        <pre className="document-code-block" key={`${contentId}-${index}`}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      index = codeIndex;
      continue;
    }
    const table = tablesByStartLine.get(index);
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
    const heading = headings.find(
      (item) => item.id === `document-${contentId}-heading-${index}`,
    );
    blocks.push(
      <MarkdownPreviewBlock
        anchorId={heading ? `${headingIdPrefix}${heading.id}` : undefined}
        key={`${contentId}-${index}`}
        line={line}
        onInternalLink={onInternalLink}
        hasChildren={false}
        collapsed={false}
        taskListMode={taskListMode}
      />,
    );
  }
  return <>{blocks}</>;
}

type NestedListRenderContext = {
  anchorId?: string;
  collapsed: Set<number>;
  documentId: string;
  headingIdPrefix: string;
  onInternalLink?: (documentId: string) => void;
  onTaskToggle?: (lineIndex: number, checked: boolean) => void;
  taskListMode: MarkdownTaskListMode;
  setCollapsed: React.Dispatch<React.SetStateAction<Set<number>>>;
};

function renderNestedListNode(
  node: NestedListNode,
  context: NestedListRenderContext,
): React.JSX.Element {
  const isCollapsed = context.collapsed.has(node.lineIndex);
  return (
    <div
      className="document-list-node"
      key={`${context.documentId}-list-node-${node.lineIndex}`}
    >
      <div className="document-list-row">
        <MarkdownPreviewBlock
          line={`${" ".repeat(node.depth * 4)}${node.marker}${node.text}`}
          onInternalLink={context.onInternalLink}
          onTaskToggle={
            context.onTaskToggle
              ? (checked) => context.onTaskToggle?.(node.lineIndex, checked)
              : undefined
          }
          taskListMode={context.taskListMode}
          hasChildren={node.children.length > 0}
          collapsed={isCollapsed}
          onToggleCollapse={
            node.children.length > 0
              ? () =>
                  context.setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(node.lineIndex)) next.delete(node.lineIndex);
                    else next.add(node.lineIndex);
                    return next;
                  })
              : undefined
          }
        />
      </div>
      {node.children.length > 0 && !isCollapsed ? (
        <div className="document-list-children">
          {node.children.map((child) => renderNestedListNode(child, context))}
        </div>
      ) : null}
    </div>
  );
}

export function hasNestedChildren(
  lines: string[],
  index: number,
  depth: 0 | 1 | 2,
): boolean {
  const next = parseNestedListItem(lines[index + 1] ?? "");
  return next !== null && next.depth > depth;
}

export function isNestedLineHidden(
  lines: string[],
  index: number,
  collapsed: Set<number>,
): boolean {
  const current = parseNestedListItem(lines[index] ?? "");
  if (!current || current.depth === 0) return false;
  let childDepth = current.depth;
  for (let cursor = index - 1; cursor >= 0 && childDepth > 0; cursor -= 1) {
    const parent = parseNestedListItem(lines[cursor] ?? "");
    if (!parent || parent.depth >= childDepth) continue;
    if (collapsed.has(cursor)) return true;
    if (parent.depth === 0) return false;
    childDepth = parent.depth;
  }
  return false;
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
  onInternalLink,
  onTaskToggle,
  taskListMode = "interactive",
  hasChildren,
  collapsed,
  onToggleCollapse,
}: {
  line: string;
  anchorId?: string;
  onInternalLink?: (documentId: string) => void;
  onTaskToggle?: (checked: boolean) => void;
  taskListMode?: MarkdownTaskListMode;
  hasChildren: boolean;
  collapsed: boolean;
  onToggleCollapse?: () => void;
}): React.JSX.Element {
  if (line === "---") return <hr />;
  if (line.startsWith("# "))
    return <h1 id={anchorId}>{renderInlineMarkdown(line.slice(2))}</h1>;
  if (line.startsWith("## "))
    return <h2 id={anchorId}>{renderInlineMarkdown(line.slice(3))}</h2>;
  if (line.startsWith("### "))
    return <h3 id={anchorId}>{renderInlineMarkdown(line.slice(4))}</h3>;
  const checklist = parseNestedListItem(line);
  if (
    checklist?.kind === "task" &&
    getMarkdownTaskListPresentation(line, taskListMode) === "literal"
  ) {
    return (
      <p
        className={`document-list-item document-checklist-static document-list-depth-${checklist.depth} ${checklist.depth === 0 ? "document-list-item-root" : ""}`}
        style={{ marginInlineStart: `${checklist.depth * 24}px` }}
      >
        <span className="markdown-task-expander-slot">
          <ListExpander
            hasChildren={hasChildren}
            collapsed={collapsed}
            onToggle={onToggleCollapse}
          />
        </span>
        <span className="markdown-task-checkbox-slot" aria-hidden="true" />
        <span className="markdown-task-content">
          {checklist.marker}
          {renderInlineMarkdown(checklist.text, onInternalLink)}
        </span>
      </p>
    );
  }
  if (checklist?.kind === "task") {
    return (
      <p
        className={`document-list-item document-checklist-item document-list-depth-${checklist.depth} ${checklist.depth === 0 ? "document-list-item-root" : ""}`}
        style={{ marginInlineStart: `${checklist.depth * 24}px` }}
      >
        <span className="markdown-task-expander-slot">
          <ListExpander
            hasChildren={hasChildren}
            collapsed={collapsed}
            onToggle={onToggleCollapse}
          />
        </span>
        <span className="markdown-task-checkbox-slot">
          <input
            aria-label="Состояние пункта"
            checked={checklist.checked}
            onChange={() => onTaskToggle?.(!checklist.checked)}
            type="checkbox"
          />
        </span>
        <span
          className={
            checklist.checked
              ? "markdown-task-content document-checklist-text is-complete"
              : "markdown-task-content document-checklist-text"
          }
        >
          {renderInlineMarkdown(checklist.text)}
        </span>
      </p>
    );
  }
  if (checklist?.kind === "bullet")
    return (
      <p
        className={`document-list-item document-list-depth-${checklist.depth} ${checklist.depth === 0 ? "document-list-item-root" : ""}`}
        style={{ marginInlineStart: `${checklist.depth * 24}px` }}
      >
        <span className="markdown-task-expander-slot">
          <ListExpander
            hasChildren={hasChildren}
            collapsed={collapsed}
            onToggle={onToggleCollapse}
          />
        </span>
        <span className="markdown-task-checkbox-slot" aria-hidden="true" />
        <span className="markdown-task-content">
          • {renderInlineMarkdown(checklist.text)}
        </span>
      </p>
    );
  if (checklist?.kind === "ordered")
    return (
      <p
        className={`document-list-item document-list-depth-${checklist.depth} ${checklist.depth === 0 ? "document-list-item-root" : ""}`}
        style={{ marginInlineStart: `${checklist.depth * 24}px` }}
      >
        <span className="markdown-task-expander-slot">
          <ListExpander
            hasChildren={hasChildren}
            collapsed={collapsed}
            onToggle={onToggleCollapse}
          />
        </span>
        <span className="markdown-task-checkbox-slot" aria-hidden="true" />
        <span className="markdown-task-content">
          {checklist.marker}
          {renderInlineMarkdown(checklist.text)}
        </span>
      </p>
    );
  if (line.startsWith("> "))
    return <blockquote>{renderInlineMarkdown(line.slice(2))}</blockquote>;
  return <p>{renderInlineMarkdown(line, onInternalLink)}</p>;
}

function ListExpander({
  hasChildren,
  collapsed,
  onToggle,
}: {
  hasChildren: boolean;
  collapsed: boolean;
  onToggle?: () => void;
}): React.JSX.Element {
  return hasChildren ? (
    <button
      aria-expanded={!collapsed}
      aria-label={
        collapsed ? "Раскрыть вложенный список" : "Свернуть вложенный список"
      }
      className="document-list-expander"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle?.();
      }}
      type="button"
    >
      <UiIcon name={collapsed ? "chevron-right" : "chevron-down"} />
    </button>
  ) : (
    <span aria-hidden="true" className="document-list-expander-spacer" />
  );
}

function renderInlineMarkdown(
  text: string,
  onInternalLink?: (documentId: string) => void,
): React.ReactNode[] {
  const tokenPattern =
    /(\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s<>]+|\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|\*[^*\n]+\*)/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match = tokenPattern.exec(text);
  while (match) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith("[[")) {
      const internal = parseInternalLinkToken(token);
      nodes.push(
        internal ? (
          <button
            className="document-internal-link"
            key={key}
            onClick={() => onInternalLink?.(internal.documentId)}
            type="button"
          >
            {internal.label}
          </button>
        ) : (
          token
        ),
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[") || /^https?:\/\//.test(token)) {
      const internal = parseInternalLinkToken(token);
      if (internal) {
        nodes.push(
          <button
            className="document-internal-link"
            key={key}
            onClick={() => onInternalLink?.(internal.documentId)}
            type="button"
          >
            {internal.label}
          </button>,
        );
        cursor = match.index + token.length;
        match = tokenPattern.exec(text);
        continue;
      }
      const link = parseExternalLinkToken(token);
      nodes.push(
        link ? (
          <React.Fragment key={key}>
            <a
              className="document-external-link"
              href={link.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              {link.label}
            </a>
            {link.trailing}
          </React.Fragment>
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
