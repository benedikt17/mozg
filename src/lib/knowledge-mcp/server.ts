import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  knowledgeEntries,
  pageEntries,
  searchEntries,
  type KnowledgeCatalog,
} from "./catalog";
import type { KnowledgeLoadResult } from "./load";
import { createNeurocomment, listOwnKnowledgeComments } from "./neurocomments";
import { getMcpAuthChallenge } from "./oauth";

const readAuth = {
  securitySchemes: [{ type: "oauth2", scopes: ["knowledge:read"] }],
};
const neuroAuth = {
  securitySchemes: [
    {
      type: "oauth2",
      scopes: ["knowledge:read", "knowledge:neurocomment:create"],
    },
  ],
};

function neurocommentGrantRequired() {
  const challenge = getMcpAuthChallenge();
  return {
    isError: true as const,
    content: [
      { type: "text" as const, text: "Neurocomment permission required" },
    ],
    ...(challenge && {
      _meta: {
        "mcp/www_authenticate": [
          `${challenge}, scope="knowledge:read knowledge:neurocomment:create", error="insufficient_scope", error_description="Approve neurocomment access in MOZG"`,
        ],
      },
    }),
  };
}

type ReadySnapshot = Omit<
  Extract<KnowledgeLoadResult, { kind: "ready" }>["snapshot"],
  "snapshot"
> & {
  snapshot: KnowledgeCatalog;
};

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

export function createKnowledgeMcpServer(
  snapshot: ReadySnapshot,
  options?: { neurocommentUserId: string },
): McpServer {
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
      _meta: readAuth,
    },
    ({ offset, limit }) =>
      result({ ...metadata, ...pageEntries(entries, offset, limit) }),
  );

  // Advertise the gated tools to existing read-only clients so ChatGPT can
  // discover the additional scope and request it through OAuth.
  server.registerTool(
    "list_knowledge_comments",
    {
      description:
        "Read the connected user's own HUMAN comments on an active Knowledge article. Use these as editorial context alongside the article Markdown. Requires the neurocomment grant.",
      inputSchema: {
        documentId: z.string().min(1).max(250),
        offset: z.number().int().nonnegative().default(0),
        limit: z.number().int().min(1).max(50).default(50),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: neuroAuth,
    },
    async ({ documentId, offset, limit }) => {
      if (!options) return neurocommentGrantRequired();
      if (!entries.some((entry) => entry.id === documentId))
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Document unavailable" }],
        };
      try {
        return result({
          ...metadata,
          documentId,
          ...(await listOwnKnowledgeComments(
            options.neurocommentUserId,
            snapshot.workspaceId,
            documentId,
            offset,
            limit,
          )),
        });
      } catch {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Comments unavailable" }],
        };
      }
    },
  );

  server.registerTool(
    "create_knowledge_neurocomment",
    {
      description:
        "Create a visually distinct AI comment anchored to ONE exact, unique quote from original article Markdown. Optional suggestedText is the exact replacement for that quote. This does not edit the article; the owner must click Внедрить in MOZG. Requires an explicit neurocomment grant.",
      inputSchema: {
        documentId: z.string().min(1).max(250),
        selectedText: z
          .string()
          .min(1)
          .max(5000)
          .refine((value) => value.trim().length > 0),
        comment: z
          .string()
          .min(1)
          .max(5000)
          .refine((value) => value.trim().length > 0),
        suggestedText: z.string().max(5000).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: neuroAuth,
    },
    async ({ documentId, selectedText, comment, suggestedText }) => {
      if (!options) return neurocommentGrantRequired();
      const entry = entries.find((item) => item.id === documentId);
      if (!entry)
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Document unavailable" }],
        };
      try {
        const created = await createNeurocomment({
          userId: options.neurocommentUserId,
          workspaceId: snapshot.workspaceId,
          documentId,
          revision: snapshot.revision,
          markdown: entry.markdown,
          quote: selectedText,
          comment,
          suggestedText,
        });
        return created.kind === "created"
          ? result({
              ...metadata,
              neurocommentId: created.id,
              status: "created",
            })
          : {
              isError: true,
              content: [{ type: "text" as const, text: created.kind }],
            };
      } catch {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: "Neurocomment unavailable" },
          ],
        };
      }
    },
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
      _meta: readAuth,
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
        "Read original Markdown by exact document ID. Follow nextOffset until null to read the entire article. Check revision across calls.",
      inputSchema: {
        documentId: z.string().min(1).max(250),
        offset: z.number().int().nonnegative().default(0),
        maxChars: z.number().int().min(100).max(50000).default(24000),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: readAuth,
    },
    ({ documentId, offset, maxChars }) => {
      const entry = entries.find((item) => item.id === documentId);
      if (!entry) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Document not found or unavailable",
            },
          ],
        };
      }
      let end = Math.min(offset + maxChars, entry.markdown.length);
      if (
        end < entry.markdown.length &&
        end > offset &&
        entry.markdown.charCodeAt(end - 1) >= 0xd800 &&
        entry.markdown.charCodeAt(end - 1) <= 0xdbff
      )
        end -= 1;
      return result({
        ...metadata,
        document: {
          ...entry,
          markdown: entry.markdown.slice(offset, end),
          totalChars: entry.markdown.length,
          nextOffset: end < entry.markdown.length ? end : null,
        },
      });
    },
  );

  return server;
}
