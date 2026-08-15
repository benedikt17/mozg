from pathlib import Path


def patch_migration() -> None:
    path = Path("supabase/migrations/20260816010000_project_file_content_search.sql")
    text = path.read_text()
    text = text.replace(
        "  target_query text,\n  target_limit integer default 200\n)",
        "  target_query text,\n  target_limit integer default 500,\n  target_offset integer default 0\n)",
        1,
    )
    text = text.replace(
        "  if target_limit is null or target_limit < 1 or target_limit > 500 then\n    raise exception using errcode = '22023', message = 'Project file search limit is invalid';\n  end if;",
        "  if target_limit is null or target_limit < 1 or target_limit > 500\n     or target_offset is null or target_offset < 0 then\n    raise exception using errcode = '22023', message = 'Project file search page is invalid';\n  end if;",
        1,
    )
    text = text.replace(
        "  limit target_limit;\nend;\n$$;\n\nrevoke all on function public.upsert_project_file_search_content",
        "  limit target_limit\n  offset target_offset;\nend;\n$$;\n\nrevoke all on function public.upsert_project_file_search_content",
        1,
    )
    text = text.replace(
        "public.search_project_files(uuid, text, text, integer)",
        "public.search_project_files(uuid, text, text, integer, integer)",
    )
    path.write_text(text)


def patch_rls_test() -> None:
    path = Path("tests/rls/project-file-content-search.test.sql")
    text = path.read_text()
    text = text.replace(
        "array['uuid', 'text', 'text', 'integer'],",
        "array['uuid', 'text', 'text', 'integer', 'integer'],",
        1,
    )
    text = text.replace(
        "public.search_project_files(uuid,text,text,integer)",
        "public.search_project_files(uuid,text,text,integer,integer)",
    )
    path.write_text(text)


def patch_repository() -> None:
    path = Path("src/lib/files/cloud-project-file-repository.ts")
    text = path.read_text()
    old = '''        const { data, error } = await this.supabase.rpc("search_project_files", {
          target_workspace_id: scope.workspaceId,
          target_project_id: scope.projectId,
          target_query: search,
          target_limit: 200,
        });
        if (error) throw error;
        return (data ?? []).map((row) => mapProjectFile(row, scope));
'''
    new = '''        const results: ProjectFileRecord[] = [];
        const pageSize = 500;
        let offset = 0;
        while (true) {
          const { data, error } = await this.supabase.rpc("search_project_files", {
            target_workspace_id: scope.workspaceId,
            target_project_id: scope.projectId,
            target_query: search,
            target_limit: pageSize,
            target_offset: offset,
          });
          if (error) throw error;
          const page = data ?? [];
          results.push(...page.map((row) => mapProjectFile(row, scope)));
          if (page.length < pageSize) break;
          offset += pageSize;
        }
        return results;
'''
    if old not in text:
        raise SystemExit("search RPC block not found")
    path.write_text(text.replace(old, new, 1))


if __name__ == "__main__":
    patch_migration()
    patch_rls_test()
    patch_repository()
