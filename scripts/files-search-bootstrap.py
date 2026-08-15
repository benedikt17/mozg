# Temporary branch bootstrap; removed before final review.
from pathlib import Path


def patch_files_repository() -> None:
    path = Path("src/lib/files/cloud-project-file-repository.ts")
    text = path.read_text()
    anchor = 'import type { Database } from "@/lib/supabase/database.types";\n'
    addition = (
        'import {\n'
        '  ensureProjectFileSearchIndex,\n'
        '  indexProjectFileForSearch,\n'
        '} from "./project-file-search-client";\n'
    )
    if addition not in text:
        if anchor not in text:
            raise SystemExit("Files repository import anchor missing")
        text = text.replace(anchor, anchor + addition, 1)

    method_start = text.index("  async listFiles(input: ListProjectFilesInput)")
    method_end = text.index("  async listPendingFiles(", method_start)
    new_method = '''  async listFiles(input: ListProjectFilesInput): Promise<ProjectFileRecord[]> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const search = input.query?.trim();
      if (search) {
        try {
          await ensureProjectFileSearchIndex(scope);
        } catch {
          // Search remains available from existing metadata/index rows even if
          // best-effort extraction is temporarily unavailable.
        }
        const { data, error } = await this.supabase.rpc("search_project_files", {
          target_workspace_id: scope.workspaceId,
          target_project_id: scope.projectId,
          target_query: search,
          target_limit: 200,
        });
        if (error) throw error;
        return (data ?? []).map((row) => mapProjectFile(row, scope));
      }

      let query = this.supabase
        .from("project_files")
        .select(PROJECT_FILE_SELECT)
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .not("ready_at", "is", null);
      if (!input.includeDeleted) query = query.is("deleted_at", null);
      if (input.folderId !== undefined) {
        const folderId = projectFileFolderId(input.folderId);
        query =
          folderId === null
            ? query.is("folder_id", null)
            : query.eq("folder_id", folderId);
      }
      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) throw error;
      return (data ?? []).map((row) => mapProjectFile(row, scope));
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

'''
    text = text[:method_start] + new_method + text[method_end:]

    return_anchor = "      return finalized;\n    } catch (cause) {"
    indexed_return = '''      void indexProjectFileForSearch({
        workspaceId: finalized.workspaceId,
        projectId: finalized.projectId,
        fileId: finalized.id,
      }).catch(() => {
        // Derived search indexing must never turn a successful upload into a failure.
      });
      return finalized;
    } catch (cause) {'''
    if return_anchor not in text:
        raise SystemExit("Finalized upload return anchor missing")
    text = text.replace(return_anchor, indexed_return, 1)
    path.write_text(text)


def patch_package_json() -> None:
    path = Path("package.json")
    text = path.read_text()
    if '"unpdf": "1.8.0"' in text:
        return
    anchor = '    "tus-js-client": "4.3.1",\n    "unified": "11.0.5",'
    replacement = (
        '    "tus-js-client": "4.3.1",\n'
        '    "unpdf": "1.8.0",\n'
        '    "unified": "11.0.5",'
    )
    if anchor not in text:
        raise SystemExit("Dependency anchor missing")
    path.write_text(text.replace(anchor, replacement, 1))


def patch_chunk_test() -> None:
    path = Path("src/lib/files/project-file-search-content.test.ts")
    text = path.read_text()
    old = '''    for (let index = 1; index < chunks.length; index += 1) {
      expect(chunks[index - 1]?.slice(-120)).toContain(
        chunks[index]?.slice(0, 120).trim().slice(0, 24),
      );
    }
'''
    new = '''    for (let index = 1; index < chunks.length; index += 1) {
      const overlapStart = chunks[index]?.slice(0, 160).trim();
      expect(overlapStart).toBeTruthy();
      expect(chunks[index - 1]).toContain(overlapStart);
    }
'''
    if old in text:
        path.write_text(text.replace(old, new, 1))


if __name__ == "__main__":
    patch_files_repository()
    patch_package_json()
    patch_chunk_test()
