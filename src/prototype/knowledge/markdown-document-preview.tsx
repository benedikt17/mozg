import React, { useState } from "react";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import type {
  List,
  ListItem,
  PhrasingContent,
  RootContent,
  Table,
  TableCell,
} from "mdast";
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

type MarkdownRenderContext = {
  collapsed: Set<number>;
  contentId: string;
  headingIdPrefix: string;
  lines: string[];
  markdown: string;
  onInternalLink?: (documentId: string) => void;
  onTaskToggle?: (lineIndex: number, checked: boolean) => void;
  setCollapsed: React.Dispatch<React.SetStateAction<Set<number>>>;
  taskListMode: MarkdownTaskListMode;
};

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
  const markdown = lines.join("\n");
  const structure = analyzeMarkdownStructure(markdown);
  const hiddenLeadingTitle =
    hideLeadingTitle &&
    structure.headings.some(
      (heading) =>
        heading.depth === 1 &&
        heading.startLineIndex === 0 &&
        heading.text === title,
    );
  const context: MarkdownRenderContext = {
    collapsed,
    contentId,
    headingIdPrefix,
    lines,
    markdown,
    onInternalLink,
    onTaskToggle,
    setCollapsed,
    taskListMode,
  };

  return (
    <>
      {structure.document.children.map((node, index) => {
        if (
          hiddenLeadingTitle &&
          node.type === "heading" &&
          node.depth === 1 &&
          node.position?.start.line === 1
        ) {
          return null;
        }
        return renderMarkdownBlock(node, context, 0, `root-${index}`);
      })}
    </>
  );
}

function renderMarkdownBlock(
  node: RootContent,
  context: MarkdownRenderContext,
  depth: number,
  key: string,
): React.ReactNode {
  switch (node.type) {
    case "paragraph": {
      const source = getBlockSource(node, context.lines);
      const legacyBullet = source.includes("\n")
        ? null
        : parseNestedListItem(source);
      if (legacyBullet?.marker === "• ") {
        const visualDepth = Math.min(depth, 2);
        return (
          <p
            className={`document-list-item document-list-depth-${visualDepth} ${visualDepth === 0 ? "document-list-item-root" : ""}`}
            key={key}
            style={{ marginInlineStart: `${visualDepth * 24}px` }}
          >
            <span className="markdown-task-expander-slot">
              <span
                aria-hidden="true"
                className="document-list-expander-spacer"
              />
            </span>
            <span className="markdown-task-checkbox-slot" aria-hidden="true" />
            <span className="markdown-task-content">
              • {renderMdastInline(node.children, context, `${key}-inline`)}
            </span>
          </p>
        );
      }
      return (
        <p key={key}>
          {renderMdastInline(node.children, context, `${key}-inline`)}
        </p>
      );
    }
    case "heading": {
      const lineIndex = Math.max(0, (node.position?.start.line ?? 1) - 1);
      const anchorId =
        node.depth <= 3
          ? `${context.headingIdPrefix}document-${context.contentId}-heading-${lineIndex}`
          : undefined;
      const content = renderMdastInline(
        node.children,
        context,
        `${key}-heading`,
      );
      switch (node.depth) {
        case 1:
          return (
            <h1 id={anchorId} key={key}>
              {content}
            </h1>
          );
        case 2:
          return (
            <h2 id={anchorId} key={key}>
              {content}
            </h2>
          );
        case 3:
          return (
            <h3 id={anchorId} key={key}>
              {content}
            </h3>
          );
        case 4:
          return <h4 key={key}>{content}</h4>;
        case 5:
          return <h5 key={key}>{content}</h5>;
        case 6:
          return <h6 key={key}>{content}</h6>;
      }
    }
    case "list":
      return renderMarkdownList(node, context, depth, key);
    case "code":
      return (
        <pre className="document-code-block" key={key}>
          <code>{node.value}</code>
        </pre>
      );
    case "blockquote":
      return (
        <blockquote key={key}>
          {node.children.map((child, index) =>
            renderMarkdownBlock(
              child,
              context,
              depth,
              `${key}-quote-${index}`,
            ),
          )}
        </blockquote>
      );
    case "thematicBreak":
      return <hr key={key} />;
    case "table":
      return <MarkdownTable context={context} key={key} table={node} />;
    case "html":
      return <p key={key}>{node.value}</p>;
    case "definition":
      return null;
    default: {
      const source = getBlockSource(node, context.lines);
      return source ? <p key={key}>{source}</p> : null;
    }
  }
}

function renderMarkdownList(
  list: List,
  context: MarkdownRenderContext,
  depth: number,
  key: string,
): React.JSX.Element {
  return (
    <div className="document-list-group" key={key}>
      {list.children.map((item, index) =>
        renderMarkdownListItem(
          item,
          list,
          index,
          context,
          depth,
          `${key}-item-${index}`,
        ),
      )}
    </div>
  );
}

function renderMarkdownListItem(
  item: ListItem,
  list: List,
  itemIndex: number,
  context: MarkdownRenderContext,
  depth: number,
  key: string,
): React.JSX.Element {
  const lineIndex = Math.max(0, (item.position?.start.line ?? 1) - 1);
  const nestedLists = item.children.filter(
    (child): child is List => child.type === "list",
  );
  const contentBlocks = item.children.filter((child) => child.type !== "list");
  const firstParagraph = contentBlocks.find(
    (child) => child.type === "paragraph",
  );
  const otherBlocks = contentBlocks.filter((child) => child !== firstParagraph);
  const hasChildren = nestedLists.length > 0;
  const isCollapsed = context.collapsed.has(lineIndex);
  const isTask = typeof item.checked === "boolean";
  const checked = item.checked === true;
  const visualDepth = Math.min(depth, 2);
  const orderedMarker = `${(list.start ?? 1) + itemIndex}. `;
  const marker = isTask
    ? `- [${checked ? "x" : " "}] `
    : list.ordered
      ? orderedMarker
      : "• ";
  const content =
    firstParagraph?.type === "paragraph"
      ? renderMdastInline(
          firstParagraph.children,
          context,
          `${key}-paragraph`,
        )
      : null;

  return (
    <div className="document-list-node" key={key}>
      <div className="document-list-row">
        <p
          className={[
            "document-list-item",
            isTask
              ? context.taskListMode === "static"
                ? "document-checklist-static"
                : "document-checklist-item"
              : "",
            `document-list-depth-${visualDepth}`,
            visualDepth === 0 ? "document-list-item-root" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ marginInlineStart: `${visualDepth * 24}px` }}
        >
          <span className="markdown-task-expander-slot">
            <ListExpander
              collapsed={isCollapsed}
              hasChildren={hasChildren}
              onToggle={
                hasChildren
                  ? () =>
                      context.setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(lineIndex)) next.delete(lineIndex);
                        else next.add(lineIndex);
                        return next;
                      })
                  : undefined
              }
            />
          </span>
          {isTask && context.taskListMode === "interactive" ? (
            <span className="markdown-task-checkbox-slot">
              <input
                aria-label="Состояние пункта"
                checked={checked}
                onChange={() => context.onTaskToggle?.(lineIndex, !checked)}
                type="checkbox"
              />
            </span>
          ) : (
            <span
              className="markdown-task-checkbox-slot"
              aria-hidden="true"
            />
          )}
          <span
            className={
              isTask && checked
                ? "markdown-task-content document-checklist-text is-complete"
                : "markdown-task-content"
            }
          >
            {isTask && context.taskListMode === "interactive" ? null : marker}
            {content}
          </span>
        </p>
      </div>
      {otherBlocks.length > 0 ? (
        <div className="document-list-children">
          {otherBlocks.map((child, index) =>
            renderMarkdownBlock(
              child,
              context,
              depth + 1,
              `${key}-content-${index}`,
            ),
          )}
        </div>
      ) : null}
      {hasChildren && !isCollapsed ? (
        <div className="document-list-children">
          {nestedLists.map((child, index) =>
            renderMarkdownList(
              child,
              context,
              depth + 1,
              `${key}-nested-${index}`,
            ),
          )}
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

function MarkdownTable({
  table,
  context,
}: {
  table: Table;
  context: MarkdownRenderContext;
}): React.JSX.Element {
  const [header, ...body] = table.children;
  return (
    <div className="document-table-scroll">
      <table>
        <thead>
          <tr>
            {header?.children.map((cell, index) => (
              <MarkdownTableCell
                cell={cell}
                context={context}
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
                  context={context}
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
  context,
  header = false,
  style,
}: {
  cell: TableCell;
  context: MarkdownRenderContext;
  header?: boolean;
  style: React.CSSProperties;
}): React.JSX.Element {
  const content = renderMdastInline(cell.children, context, "table-cell");
  return header ? (
    <th style={style}>{content}</th>
  ) : (
    <td style={style}>{content}</td>
  );
}

function renderMdastInline(
  nodes: PhrasingContent[],
  context: MarkdownRenderContext,
  keyPrefix: string,
): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text":
        return node.value;
      case "emphasis":
        return (
          <em key={key}>
            {renderMdastInline(node.children, context, key)}
          </em>
        );
      case "strong":
        return (
          <strong key={key}>
            {renderMdastInline(node.children, context, key)}
          </strong>
        );
      case "delete":
        return (
          <del key={key}>{renderMdastInline(node.children, context, key)}</del>
        );
      case "inlineCode":
        return <code key={key}>{node.value}</code>;
      case "break":
        return <br key={key} />;
      case "wikiLink": {
        const internal = parseInternalLinkToken(node.raw);
        return internal ? (
          <button
            className="document-internal-link"
            key={key}
            onClick={() => context.onInternalLink?.(internal.documentId)}
            type="button"
          >
            {internal.label}
          </button>
        ) : (
          node.raw
        );
      }
      case "link":
        return /^https?:\/\//.test(node.url) ? (
          <a
            className="document-external-link"
            href={node.url}
            key={key}
            rel="noopener noreferrer"
            target="_blank"
          >
            {renderMdastInline(node.children, context, key)}
          </a>
        ) : (
          `[${getPhrasingText(node.children)}](${node.url}${node.title ? ` "${node.title}"` : ""})`
        );
      case "image":
        return `![${node.alt ?? ""}](${node.url}${node.title ? ` "${node.title}"` : ""})`;
      case "linkReference":
        return formatLinkReference(node);
      case "imageReference":
        return formatImageReference(node);
      case "html":
        return node.value;
      default:
        if ("value" in node && typeof node.value === "string") return node.value;
        if ("children" in node)
          return renderMdastInline(node.children, context, key);
        if ("label" in node && typeof node.label === "string") return node.label;
        return node.type;
    }
  });
}

function formatLinkReference(
  node: Extract<PhrasingContent, { type: "linkReference" }>,
): string {
  const text = getPhrasingText(node.children);
  if (node.referenceType === "shortcut") return `[${text}]`;
  if (node.referenceType === "collapsed") return `[${text}][]`;
  return `[${text}][${node.label ?? node.identifier}]`;
}

function formatImageReference(
  node: Extract<PhrasingContent, { type: "imageReference" }>,
): string {
  const alt = node.alt ?? "";
  if (node.referenceType === "shortcut") return `![${alt}]`;
  if (node.referenceType === "collapsed") return `![${alt}][]`;
  return `![${alt}][${node.label ?? node.identifier}]`;
}

function getPhrasingText(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) => {
      if (node.type === "wikiLink") return node.value;
      if ("value" in node && typeof node.value === "string") return node.value;
      if ("children" in node) return getPhrasingText(node.children);
      if ("alt" in node && typeof node.alt === "string") return node.alt;
      return "";
    })
    .join("");
}

function getBlockSource(
  node: RootContent,
  lines: string[],
): string {
  const startLine = node.position?.start.line;
  const endLine = node.position?.end.line;
  if (startLine === undefined || endLine === undefined) return "";
  return lines.slice(startLine - 1, endLine).join("\n");
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
