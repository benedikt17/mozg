from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/prototype/desktop-mock-data.ts",
    'export type ProjectSection =\n  "overview" | "knowledge" | "tasks" | "canvases" | "inbox";',
    'export type ProjectSection =\n  | "overview"\n  | "knowledge"\n  | "tasks"\n  | "canvases"\n  | "files"\n  | "inbox";',
)
replace_once(
    "src/prototype/desktop-mock-data.ts",
    '  {\n    id: "canvases",\n    label: "Холсты",\n    description: "Пространство схем, объектов и отношений проекта.",\n  },\n  {\n    id: "inbox",',
    '  {\n    id: "canvases",\n    label: "Холсты",\n    description: "Пространство схем, объектов и отношений проекта.",\n  },\n  {\n    id: "files",\n    label: "Файлы",\n    description: "Папки и оригиналы файлов текущего проекта.",\n  },\n  {\n    id: "inbox",',
)
replace_once(
    "src/prototype/desktop-mock-data.ts",
    '["overview", "knowledge", "tasks", "canvases"].includes(id)',
    '["overview", "knowledge", "tasks", "canvases", "files"].includes(id)',
)

replace_once(
    "src/prototype/desktop-shell.tsx",
    'import { DesktopCanvasWorkspace } from "@/prototype/canvases/desktop-canvas-workspace";\n',
    'import { DesktopCanvasWorkspace } from "@/prototype/canvases/desktop-canvas-workspace";\nimport { FilesWorkspace } from "@/prototype/files/files-workspace";\n',
)
replace_once(
    "src/prototype/desktop-shell.tsx",
    '  if (state.activeSection === "inbox") {\n    return <InboxWorkspace state={state} dispatch={dispatch} />;\n  }',
    '  if (state.activeSection === "files") {\n    return (\n      <FilesWorkspace\n        key={`${options?.workspaceId ?? "local"}:${state.activeProjectId}`}\n        projectId={state.activeProjectId}\n        projectName={getActiveProject(state).name}\n        workspaceId={options?.workspaceId}\n      />\n    );\n  }\n  if (state.activeSection === "inbox") {\n    return <InboxWorkspace state={state} dispatch={dispatch} />;\n  }',
)

replace_once(
    "src/prototype/files/files-workspace.tsx",
    'type FilesWorkspaceProps = {\n  workspaceId: string;\n  projectId: string;\n  projectName: string;\n};',
    'type FilesWorkspaceProps = {\n  workspaceId?: string;\n  projectId: string;\n  projectName: string;\n};',
)
replace_once(
    "src/prototype/files/files-workspace.tsx",
    '  useEffect(() => {\n    let cancelled = false;',
    '  useEffect(() => {\n    if (!workspaceId) return;\n    let cancelled = false;',
)
replace_once(
    "src/prototype/files/files-workspace.tsx",
    '  const breadcrumbs = getProjectFolderBreadcrumbs(folders, activeFolderId);',
    '  const effectiveStatus: FilesLoadStatus = workspaceId ? status : "error";\n  const breadcrumbs = getProjectFolderBreadcrumbs(folders, activeFolderId);',
)
replace_once(
    "src/prototype/files/files-workspace.tsx",
    '        <div className={styles.headingBlock}>\n          <h2>Файлы</h2>\n          <span>{projectName}</span>\n        </div>',
    '        <div className={styles.headingBlock}>\n          <h2>Файлы</h2>\n        </div>',
)
replace_once(
    "src/prototype/files/files-workspace.tsx",
    '<section aria-busy={status === "loading"} className={styles.content}>',
    '<section\n        aria-busy={effectiveStatus === "loading"}\n        className={styles.content}\n      >',
)
replace_once(
    "src/prototype/files/files-workspace.tsx",
    '{status === "loading" ? (',
    '{effectiveStatus === "loading" ? (',
)
replace_once(
    "src/prototype/files/files-workspace.tsx",
    '{status === "error" ? (',
    '{effectiveStatus === "error" ? (',
)
replace_once(
    "src/prototype/files/files-workspace.tsx",
    '            <span>\n              Preview-бэкенд для этого раздела ещё не подключён или не отвечает.\n            </span>\n            <button\n              onClick={() => {\n                setStatus("loading");\n                setReloadToken((value) => value + 1);\n              }}\n              type="button"\n            >\n              Повторить\n            </button>',
    '            <span>\n              {workspaceId\n                ? "Не удалось загрузить файлы проекта. Попробуйте ещё раз."\n                : "Файлы доступны в облачном рабочем пространстве."}\n            </span>\n            {workspaceId ? (\n              <button\n                onClick={() => {\n                  setStatus("loading");\n                  setReloadToken((value) => value + 1);\n                }}\n                type="button"\n              >\n                Повторить\n              </button>\n            ) : null}',
)
replace_once(
    "src/prototype/files/files-workspace.tsx",
    '{status === "ready" && !hasEntries ? (',
    '{effectiveStatus === "ready" && !hasEntries ? (',
)
replace_once(
    "src/prototype/files/files-workspace.tsx",
    '{status === "ready" && hasEntries ? (',
    '{effectiveStatus === "ready" && hasEntries ? (',
)

replace_once(
    "src/prototype/shell/mobile-navigation.tsx",
    '            <div className="mobile-more-section mobile-more-actions">\n              <button\n                onClick={() => {\n                  dispatch({ type: "open-command-palette" });',
    '            <div className="mobile-more-section mobile-more-actions">\n              <button\n                data-active={state.activeSection === "files" ? "true" : "false"}\n                onClick={() => {\n                  dispatch({ type: "switch-section", section: "files" });\n                  setMoreOpen(false);\n                }}\n                type="button"\n              >\n                <UiIcon name="folder" />\n                <span>Файлы</span>\n              </button>\n              <button\n                onClick={() => {\n                  dispatch({ type: "open-command-palette" });',
)

Path("src/app/prototype/desktop/files/page.tsx").write_text(
    'import { redirect } from "next/navigation";\n\n'
    'export default function ProjectFilesPreviewPage(): never {\n'
    '  redirect("/prototype/desktop?section=files");\n'
    '}\n',
    encoding="utf-8",
)

replace_once(
    "tests/e2e/critical-desktop.spec.ts",
    'test("authenticates and navigates the four primary Desktop sections", async ({',
    'test("authenticates and navigates the five primary Desktop sections", async ({',
)
replace_once(
    "tests/e2e/critical-desktop.spec.ts",
    '  for (const section of ["Обзор", "Знания", "Задачи", "Холсты"] as const) {',
    '  for (const section of [\n    "Обзор",\n    "Знания",\n    "Задачи",\n    "Холсты",\n    "Файлы",\n  ] as const) {',
)
old_preview_test = '''test("opens the authenticated Project Files preview through the cloud repository", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/prototype/desktop/files");

  await expect(
    page.getByText("Preview · Файлы", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Файлы" })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue("lukomorie");
  await expect(page.getByText("Папка пуста", { exact: true })).toBeVisible();
});'''
new_preview_test = '''test("opens Project Files inside the normal Desktop shell", async ({ page }) => {
  await signIn(page);

  const navigation = page.getByRole("navigation", {
    name: "Разделы приложения",
  });
  const filesButton = navigation.getByRole("button", {
    name: "Файлы",
    exact: true,
  });
  await filesButton.click();

  await expect(filesButton).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Файлы" })).toBeVisible();
  await expect(page.getByText("Папка пуста", { exact: true })).toBeVisible();
  await expect(page.getByText("Preview · Файлы", { exact: true })).toHaveCount(0);
});

test("redirects the retired Files harness route into the Desktop section", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/prototype/desktop/files");

  await expect(page).toHaveURL(/\\/prototype\\/desktop\\?section=files$/);
  await expect(
    page
      .getByRole("navigation", { name: "Разделы приложения" })
      .getByRole("button", { name: "Файлы", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});'''
replace_once(
    "tests/e2e/critical-desktop.spec.ts", old_preview_test, new_preview_test
)

for obsolete_path in (
    "src/prototype/files/files-preview-shell.tsx",
    "src/prototype/files/files-preview-shell.module.css",
):
    Path(obsolete_path).unlink()
