import React from "react";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";

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
