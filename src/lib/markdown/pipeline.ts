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
): RootContent[] {
  const byToken = new Map(
    placeholders.map((placeholder) => [placeholder.token, placeholder]),
  );
  const tokenPattern = new RegExp(
    `(${placeholders.map(({ token }) => token).join("|")})`,
    "g",
  );

  return node.value
    .split(tokenPattern)
    .filter((value) => value.length > 0)
    .map((value): RootContent => {
      const placeholder = byToken.get(value);
      if (!placeholder) return { type: "text", value };

      return {
        type: "wikiLink",
        title: placeholder.reference.title,
        raw: placeholder.reference.raw,
        value: placeholder.reference.title,
      };
    });
}

function materializeWikiLinkNodes(
  parent: ParentNode,
  placeholders: Placeholder[],
): void {
  parent.children = parent.children.flatMap((child) => {
    if (child.type === "text") return expandTextNode(child, placeholders);
    if (isParentNode(child)) materializeWikiLinkNodes(child, placeholders);
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
  materializeWikiLinkNodes(document, prepared.placeholders);
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
