import type { Literal, Root } from "mdast";

export interface WikiLinkNode extends Literal {
  type: "wikiLink";
  title: string;
  raw: string;
  value: string;
}

declare module "mdast" {
  interface PhrasingContentMap {
    wikiLink: WikiLinkNode;
  }

  interface RootContentMap {
    wikiLink: WikiLinkNode;
  }
}

export type MarkdownDocument = Root & {
  data: Root["data"] & {
    wikiLinks: ParsedWikiLink[];
  };
};

export type ParsedTaskReference = {
  id: string;
  title: string;
  checkedMarker: boolean;
  lineOrPosition: number;
  occurrence: number;
  isDuplicate: boolean;
};

export type ParsedWikiLink = {
  title: string;
  raw: string;
  lineOrPosition: number;
  start: number;
  end: number;
};
