import type { Root } from "mdast";

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
