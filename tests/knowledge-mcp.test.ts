import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createKnowledgeMcpServer } from "@/lib/knowledge-mcp/server";
import type { DesktopDomainSnapshotV3 } from "@/prototype/persistence/desktop-snapshot-contracts";

const project = (id: string, name: string) => ({
  id,
  name,
  shortName: name,
  description: "",
});
const document = (
  id: string,
  projectId: string,
  content: string[],
  deletedAt?: string,
) => ({
  id,
  projectId,
  title: `Статья ${id}`,
  folder: "Мир",
  folderPath: ["Мир", "Правила"],
  excerpt: "",
  content,
  backlinks: [],
  ...(deletedAt ? { deletedAt } : {}),
});

const catalog = {
  projects: [project("one", "Лукоморье"), project("two", "Фильм")],
  documents: [
    document("first", "one", ["# Заголовок", "", "Дракон живёт в горах"]),
    document("second", "two", ["Дракон живёт у моря"]),
    document("deleted", "one", ["Дракон удалён"], "2026-09-01T00:00:00Z"),
  ],
} satisfies Pick<DesktopDomainSnapshotV3, "projects" | "documents">;

function toolJson(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  const first = Array.isArray(result.content) ? result.content[0] : undefined;
  if (!first || first.type !== "text") throw new Error("Missing text result");
  return JSON.parse(first.text);
}

describe("read-only knowledge MCP", () => {
  it("advertises neurocomment tools with their required scope", async () => {
    const server = createKnowledgeMcpServer(
      {
        workspaceId: "workspace",
        workspaceName: "Workspace",
        revision: 17,
        updatedAt: "2026-09-27T00:00:00Z",
        schemaVersion: 3,
        snapshot: catalog,
      },
      { neurocommentUserId: "user" },
    );
    const client = new Client({ name: "test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain(
        "create_knowledge_neurocomment",
      );
      expect(tools.tools.map((tool) => tool.name)).toContain(
        "list_knowledge_comments",
      );
      expect(
        tools.tools.find(
          (tool) => tool.name === "create_knowledge_neurocomment",
        )?._meta?.securitySchemes,
      ).toEqual([
        {
          type: "oauth2",
          scopes: ["knowledge:read", "knowledge:neurocomment:create"],
        },
      ]);
      const missing = await client.callTool({
        name: "list_knowledge_comments",
        arguments: { documentId: "deleted" },
      });
      expect(missing.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });
  it("lists all active documents across projects, pages without gaps, and reads exact Markdown", async () => {
    vi.stubEnv("MOZG_MCP_SCOPED_AUTH", "enabled");
    vi.stubEnv("MOZG_MCP_PUBLIC_URL", "https://mozg.example/api/mcp");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-key");
    const server = createKnowledgeMcpServer({
      workspaceId: "workspace",
      workspaceName: "Workspace",
      revision: 17,
      updatedAt: "2026-09-27T00:00:00Z",
      schemaVersion: 3,
      snapshot: catalog,
    });
    const client = new Client({ name: "test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        "create_knowledge_neurocomment",
        "list_knowledge_comments",
        "list_knowledge_documents",
        "read_knowledge_document",
        "search_knowledge_documents",
      ]);

      for (const name of [
        "list_knowledge_comments",
        "create_knowledge_neurocomment",
      ]) {
        const denied = await client.callTool({
          name,
          arguments: {
            documentId: "first",
            ...(name === "create_knowledge_neurocomment"
              ? { selectedText: "Дракон живёт в горах", comment: "Проверка" }
              : {}),
          },
        });
        expect(denied.isError).toBe(true);
        expect(denied.content).toMatchObject([
          { type: "text", text: "Neurocomment permission required" },
        ]);
        expect(denied._meta?.["mcp/www_authenticate"]).toEqual([
          expect.stringContaining('error="insufficient_scope"'),
        ]);
      }

      const first = toolJson(
        await client.callTool({
          name: "list_knowledge_documents",
          arguments: { limit: 1 },
        }),
      ) as {
        total: number;
        nextOffset: number;
        items: { id: string }[];
        revision: number;
      };
      const second = toolJson(
        await client.callTool({
          name: "list_knowledge_documents",
          arguments: { offset: first.nextOffset, limit: 1 },
        }),
      ) as {
        total: number;
        nextOffset: null;
        items: { id: string }[];
      };
      expect(first).toMatchObject({ total: 2, revision: 17, nextOffset: 1 });
      expect([first.items[0].id, second.items[0].id]).toEqual([
        "first",
        "second",
      ]);
      expect(second.nextOffset).toBeNull();

      expect(
        toolJson(
          await client.callTool({
            name: "read_knowledge_document",
            arguments: { documentId: "first" },
          }),
        ),
      ).toMatchObject({
        document: {
          markdown: "# Заголовок\n\nДракон живёт в горах",
          folderPath: ["Мир", "Правила"],
        },
      });
      expect(
        toolJson(
          await client.callTool({
            name: "search_knowledge_documents",
            arguments: { query: "ДРАКОН" },
          }),
        ),
      ).toMatchObject({ total: 2 });
      const missing = await client.callTool({
        name: "read_knowledge_document",
        arguments: { documentId: "deleted" },
      });
      expect(missing.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
      vi.unstubAllEnvs();
    }
  });

  it("pages a long article without losing text", async () => {
    const markdown = "Текст 🎨 ".repeat(7000);
    const server = createKnowledgeMcpServer({
      workspaceId: "workspace",
      workspaceName: "Workspace",
      revision: 18,
      updatedAt: "2026-09-27T00:00:00Z",
      schemaVersion: 3,
      snapshot: {
        projects: catalog.projects,
        documents: [document("long", "one", [markdown])],
      },
    });
    const client = new Client({ name: "test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    try {
      let offset: number | null = 0;
      let reconstructed = "";
      while (offset !== null) {
        const response = toolJson(
          await client.callTool({
            name: "read_knowledge_document",
            arguments: { documentId: "long", offset, maxChars: 12000 },
          }),
        ) as {
          document: {
            markdown: string;
            nextOffset: number | null;
            totalChars: number;
          };
        };
        expect(response.document.totalChars).toBe(markdown.length);
        reconstructed += response.document.markdown;
        offset = response.document.nextOffset;
      }
      expect(reconstructed).toBe(markdown);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
