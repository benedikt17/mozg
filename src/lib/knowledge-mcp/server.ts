import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  knowledgeEntries,
  pageEntries,
  searchEntries,
  type KnowledgeCatalog,
} from "./catalog";
import type { KnowledgeLoadResult } from "./load";

type ReadySnapshot = Omit<
  Extract<KnowledgeLoadResult, { kind: "ready" }>["snapshot"],
  "snapshot"
> & {
  snapshot: KnowledgeCatalog;
};

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

export function createKnowledgeMcpServer(snapshot: ReadySnapshot): McpServer {
  const server = new McpServer({ name: "mozg-knowledge", version: "0.1.0" });
  const entries = knowledgeEntries(snapshot.snapshot);
  const metadata = {
    workspaceId: snapshot.workspaceId,
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
  };

  server.registerTool(
    "list_knowledge_documents",
    {
      description:
        "List all active MOZG knowledge documents across all projects. Follow nextOffset to cover the whole corpus; use read_knowledge_document for complete Markdown.",
      inputSchema: {
        offset: z.number().int().nonnegative().default(0),
        limit: z.number().int().min(1).max(50).default(50),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ offset, limit }) =>
      result({ ...metadata, ...pageEntries(entries, offset, limit) }),
  );

  server.registerTool(
    "search_knowledge_documents",
    {
      description:
        "Search active MOZG knowledge documents by literal text in title, folder, project, or Markdown. For comprehensive audits, list and read every document; a search alone can miss related claims.",
      inputSchema: {
        query: z.string().min(1).max(250),
        offset: z.number().int().nonnegative().default(0),
        limit: z.number().int().min(1).max(50).default(50),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ query, offset, limit }) =>
      result({
        ...metadata,
        ...pageEntries(searchEntries(entries, query), offset, limit),
      }),
  );

  server.registerTool(
    "read_knowledge_document",
    {
      description:
        "Read the complete original Markdown of one active MOZG knowledge document by its exact ID.",
      inputSchema: { documentId: z.string().min(1).max(250) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ documentId }) => {
      const entry = entries.find((item) => item.id === documentId);
      return entry
        ? result({ ...metadata, document: entry })
        : {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "Document not found or unavailable",
              },
            ],
          };
    },
  );

  return server;
}
