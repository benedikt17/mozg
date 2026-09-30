import type { Root, RootContent, Text } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { extractWikiLinks } from "@/lib/markdown/references";
import type {
  MarkdownDocument,
  ParsedWikiLink,
  WikiLinkNode,
} from "@/lib/markdown/types";

const parser = unified().use(remarkParse).use(remarkGfm);

const serializer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkStringify, {
    bullet: "-",
    emphasis: "*",
    fences: true,
    listItemIndent: "one",
    rule: "-",
    strong: "*",
    handlers: {
      wikiLink: (node: WikiLinkNode) => node.raw,
    },
  });

type ParentNode = Root | Extract<RootContent, { children: unknown }>;

type Placeholder = {
  token: string;
  reference: ParsedWikiLink;
};

function replaceWikiLinksWithPlaceholders(
  markdown: string,
  references: ParsedWikiLink[],
): { markdown: string; placeholders: Placeholder[] } {
  let nonce = 0;
  let prefix = `\uE000mozg-wiki-${nonce}-`;
  while (markdown.includes(prefix)) {
    nonce += 1;
    prefix = `\uE000mozg-wiki-${nonce}-`;
  }

  const placeholders = references.map((reference, index) => ({
    token: `${prefix}${index}\uE001`,
    reference,
  }));
  let prepared = markdown;

  for (let index = placeholders.length - 1; index >= 0; index -= 1) {
    const { reference, token } = placeholders[index];
    prepared = `${prepared.slice(0, reference.start)}${token}${prepared.slice(reference.end)}`;
  }

  return { markdown: prepared, placeholders };
}

function isParentNode(
  node: RootContent,
): node is Extract<RootContent, { children: unknown }> {
  return "children" in node;
}

function expandTextNode(
  node: Text,
  placeholders: Placeholder[],
  pointAt: (offset: number) => { line: number; column: number; offset: number },
): RootContent[] {
  if (placeholders.length === 0) return [node];
  const byToken = new Map(
    placeholders.map((placeholder) => [placeholder.token, placeholder]),
  );
  const tokenPattern = new RegExp(
    `(${placeholders.map(({ token }) => token).join("|")})`,
    "g",
  );

  const parts = node.value
    .split(tokenPattern)
    .filter((value) => value.length > 0);
  if (!parts.some((value) => byToken.has(value))) return [node];
  let sourceOffset = node.position?.start.offset ?? 0;
  return parts.map((value, index): RootContent => {
    const placeholder = byToken.get(value);
    if (!placeholder) {
      const next = byToken.get(parts[index + 1] ?? "");
      const end =
        next?.reference.start ?? node.position?.end.offset ?? sourceOffset;
      const text: Text = {
        type: "text",
        value,
        position: { start: pointAt(sourceOffset), end: pointAt(end) },
      };
      sourceOffset = end;
      return text;
    }
    sourceOffset = placeholder.reference.end;

    return {
      type: "wikiLink",
      title: placeholder.reference.title,
      raw: placeholder.reference.raw,
      value: placeholder.reference.title,
      position: {
        start: pointAt(placeholder.reference.start),
        end: pointAt(placeholder.reference.end),
      },
    };
  });
}

function materializeWikiLinkNodes(
  parent: ParentNode,
  placeholders: Placeholder[],
  pointAt: (offset: number) => { line: number; column: number; offset: number },
): void {
  parent.children = parent.children.flatMap((child) => {
    if (child.type === "text")
      return expandTextNode(child, placeholders, pointAt);
    if (isParentNode(child))
      materializeWikiLinkNodes(child, placeholders, pointAt);
    return child;
  }) as typeof parent.children;
}

export function normalizeMarkdownLineEndings(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n");
}

export function parseMarkdown(markdown: string): MarkdownDocument {
  const normalized = normalizeMarkdownLineEndings(markdown);
  const wikiLinks = extractWikiLinks(normalized);
  const prepared = replaceWikiLinksWithPlaceholders(normalized, wikiLinks);
  const document = parser.parse(prepared.markdown) as Root;
  const pointAt = (
    offset: number,
  ): { line: number; column: number; offset: number } => {
    const before = normalized.slice(0, offset);
    return {
      offset,
      line: before.split("\n").length,
      column: offset - before.lastIndexOf("\n"),
    };
  };
  const originalOffset = (offset: number): number => {
    let delta = 0;
    for (const { token, reference } of prepared.placeholders) {
      const preparedStart = reference.start + delta;
      if (offset <= preparedStart) break;
      if (offset < preparedStart + token.length) return reference.start;
      delta += token.length - (reference.end - reference.start);
    }
    return offset - delta;
  };
  const restorePositions = (node: Root | RootContent): void => {
    if (node.position) {
      node.position = {
        start: pointAt(originalOffset(node.position.start.offset ?? 0)),
        end: pointAt(
          originalOffset(node.position.end.offset ?? normalized.length),
        ),
      };
    }
    if ("children" in node)
      for (const child of node.children) restorePositions(child as RootContent);
  };
  restorePositions(document);
  materializeWikiLinkNodes(document, prepared.placeholders, pointAt);
  return Object.assign(document, {
    data: {
      ...document.data,
      wikiLinks,
    },
  });
}

export function serializeMarkdown(document: MarkdownDocument): string {
  return serializer.stringify(document);
}
