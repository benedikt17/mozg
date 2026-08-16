import type { DesktopPrototypeAction } from "@/prototype/desktop-state";

type KnowledgeLinkSourcePane = "primary" | "secondary";

type KnowledgeInternalLinkNavigation = {
  sourcePane: KnowledgeLinkSourcePane;
  splitEnabled: boolean;
  targetDocumentId: string;
};

export function getKnowledgeInternalLinkNavigationActions({
  sourcePane,
  splitEnabled,
  targetDocumentId,
}: KnowledgeInternalLinkNavigation): DesktopPrototypeAction[] {
  const targetPane = sourcePane === "primary" ? "secondary" : "primary";
  return [
    ...(splitEnabled
      ? []
      : ([{ type: "toggle-knowledge-split-view" }] as const)),
    { type: "activate-knowledge-pane", pane: targetPane },
    {
      type: "open-knowledge-document-in-active-pane",
      documentId: targetDocumentId,
    },
  ];
}
