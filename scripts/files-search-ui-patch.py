from pathlib import Path

path = Path("src/prototype/files/files-workspace.tsx")
text = path.read_text()

import_anchor = 'import { SupabaseProjectFileRepository } from "@/lib/files/cloud-project-file-repository";\n'
import_addition = 'import { ensureProjectFileSearchIndex } from "@/lib/files/project-file-search-client";\n'
if import_addition not in text:
    if import_anchor not in text:
        raise SystemExit("search import anchor missing")
    text = text.replace(import_anchor, import_anchor + import_addition, 1)

state_anchor = '  const [query, setQuery] = useState("");\n'
state_addition = '  const [debouncedQuery, setDebouncedQuery] = useState("");\n'
if state_addition not in text:
    if state_anchor not in text:
        raise SystemExit("query state anchor missing")
    text = text.replace(state_anchor, state_anchor + state_addition, 1)

folder_anchor = '  const activeFolderId = location.kind === "folder" ? location.folderId : null;\n\n'
background_effect = '''  useEffect(() => {
    if (!workspaceId) return;
    void ensureProjectFileSearchIndex({ workspaceId, projectId }).catch(() => {
      // Search content is a disposable derived index. Files stays usable when a
      // best-effort background indexing pass is temporarily unavailable.
    });
  }, [projectId, workspaceId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

'''
if background_effect not in text:
    if folder_anchor not in text:
        raise SystemExit("active folder anchor missing")
    text = text.replace(folder_anchor, folder_anchor + background_effect, 1)

if '    const trimmedQuery = query.trim();\n' not in text:
    raise SystemExit("trimmed query anchor missing")
text = text.replace(
    '    const trimmedQuery = query.trim();\n',
    '    const trimmedQuery = debouncedQuery.trim();\n',
    1,
)

old_deps = '''    projectId,
    query,
    reloadToken,
'''
new_deps = '''    projectId,
    debouncedQuery,
    reloadToken,
'''
if old_deps not in text:
    raise SystemExit("search effect dependency anchor missing")
text = text.replace(old_deps, new_deps, 1)

text = text.replace(
    '    setQuery("");\n    setSelectedFileId(null);',
    '    setQuery("");\n    setDebouncedQuery("");\n    setSelectedFileId(null);',
)

if ': "Файл или папка"' not in text:
    raise SystemExit("search placeholder anchor missing")
text = text.replace(': "Файл или папка"', ': "Поиск по имени и содержимому"', 1)

preview_state_anchor = '  const [downloadingOriginal, setDownloadingOriginal] = useState(false);\n'
preview_state_addition = '  const [openingOriginal, setOpeningOriginal] = useState(false);\n'
if preview_state_addition not in text:
    if preview_state_anchor not in text:
        raise SystemExit("preview state anchor missing")
    text = text.replace(
        preview_state_anchor,
        preview_state_anchor + preview_state_addition,
        1,
    )

open_function_anchor = '  const downloadOriginal = async () => {\n'
open_function = '''  const openOriginal = async () => {
    if (openingOriginal) return;
    setOpeningOriginal(true);
    try {
      const download = await repository.downloadFile({
        workspaceId,
        projectId,
        fileId: file.id,
      });
      const objectUrl = URL.createObjectURL(download.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } finally {
      setOpeningOriginal(false);
    }
  };

'''
if open_function not in text:
    if open_function_anchor not in text:
        raise SystemExit("download function anchor missing")
    text = text.replace(open_function_anchor, open_function + open_function_anchor, 1)

action_anchor = '''        <PrototypeButton
          disabled={downloadingOriginal}
          onClick={() => void downloadOriginal()}
'''
open_button = '''        {canOpenProjectFileInBrowser(file.mimeType) ? (
          <PrototypeButton
            disabled={openingOriginal}
            onClick={() => void openOriginal()}
            size="compact"
            variant="default"
          >
            {openingOriginal ? "Открытие…" : "Открыть"}
          </PrototypeButton>
        ) : null}
'''
if open_button not in text:
    if action_anchor not in text:
        raise SystemExit("preview action anchor missing")
    text = text.replace(action_anchor, open_button + action_anchor, 1)

helper_anchor = 'function projectFileUploadErrorMessage(cause: unknown): string {\n'
helper = '''export function canOpenProjectFileInBrowser(
  mimeType: ProjectFileRecord["mimeType"],
): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "application/json"
  );
}

'''
if helper not in text:
    if helper_anchor not in text:
        raise SystemExit("helper anchor missing")
    text = text.replace(helper_anchor, helper + helper_anchor, 1)

path.write_text(text)
