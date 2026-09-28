import { describe, expect, it, vi } from "vitest";
import { loadOpenNeurocommentDocumentIds } from "@/prototype/knowledge/knowledge-annotations";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/browser", () => ({ createClient }));

describe("Knowledge neurocomment index", () => {
  it("loads open agent comments only for the current user and workspace, across pages", async () => {
    const range = vi.fn(async (from: number) => ({
      data:
        from === 0
          ? Array.from({ length: 1000 }, (_, index) => ({
              document_id: index % 2 ? "article-a" : "article-b",
            }))
          : [{ document_id: "article-c" }],
      error: null,
    }));
    const order = vi.fn(() => ({ range }));
    const is = vi.fn(() => ({ order }));
    const eqKind = vi.fn(() => ({ is }));
    const eqUser = vi.fn(() => ({ eq: eqKind }));
    const eqWorkspace = vi.fn(() => ({ eq: eqUser }));
    const select = vi.fn(() => ({ eq: eqWorkspace }));
    const from = vi.fn(() => ({ select }));
    createClient.mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
      from,
    });

    expect(await loadOpenNeurocommentDocumentIds("workspace-1")).toEqual(
      new Set(["article-a", "article-b", "article-c"]),
    );
    expect(from).toHaveBeenCalledWith("knowledge_annotations");
    expect(select).toHaveBeenCalledWith("document_id");
    expect(eqWorkspace).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(eqUser).toHaveBeenCalledWith("created_by", "user-1");
    expect(eqKind).toHaveBeenCalledWith("kind", "agent");
    expect(is).toHaveBeenCalledWith("resolved_at", null);
    expect(range).toHaveBeenCalledTimes(2);
    expect(range).toHaveBeenCalledWith(1000, 1999);
  });
});
