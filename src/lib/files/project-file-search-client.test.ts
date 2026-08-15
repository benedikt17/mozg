import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ensureProjectFileSearchIndex,
  indexProjectFileForSearch,
} from "./project-file-search-client";

function indexResponse(input: {
  attempted: number;
  indexed: number;
  failures?: Array<{ fileId: string; reason: string }>;
  readOnly?: boolean;
}): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      attempted: input.attempted,
      indexed: input.indexed,
      failures: input.failures ?? [],
      readOnly: input.readOnly ?? false,
    }),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Project file search index client", () => {
  it("drains every available batch before resolving a Project search index", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(indexResponse({ attempted: 8, indexed: 8 }))
      .mockResolvedValueOnce(indexResponse({ attempted: 8, indexed: 8 }))
      .mockResolvedValueOnce(indexResponse({ attempted: 3, indexed: 3 }));
    vi.stubGlobal("fetch", fetchMock);

    const scope = {
      workspaceId: "10000000-0000-4000-8000-000000000001",
      projectId: "backfill-all-project-files",
    };
    await ensureProjectFileSearchIndex(scope);
    await ensureProjectFileSearchIndex(scope);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.map((call) => JSON.parse(call[1].body)),
    ).toEqual([
      { ...scope, limit: 8 },
      { ...scope, limit: 8 },
      { ...scope, limit: 8 },
    ]);
  });

  it("coalesces concurrent searches for the same Project", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const scope = {
      workspaceId: "10000000-0000-4000-8000-000000000002",
      projectId: "concurrent-project-search",
    };
    const first = ensureProjectFileSearchIndex(scope);
    const second = ensureProjectFileSearchIndex(scope);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveResponse?.(indexResponse({ attempted: 0, indexed: 0 }));
    await Promise.all([first, second]);
  });

  it("reopens a completed Project backfill when exact upload indexing fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(indexResponse({ attempted: 0, indexed: 0 }))
      .mockResolvedValueOnce(
        indexResponse({
          attempted: 1,
          indexed: 0,
          failures: [{ fileId: "file-a", reason: "temporary failure" }],
        }),
      )
      .mockResolvedValueOnce(indexResponse({ attempted: 0, indexed: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    const scope = {
      workspaceId: "10000000-0000-4000-8000-000000000003",
      projectId: "upload-invalidates-index",
    };
    await ensureProjectFileSearchIndex(scope);
    await indexProjectFileForSearch({ ...scope, fileId: "file-a" });
    await ensureProjectFileSearchIndex(scope);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
