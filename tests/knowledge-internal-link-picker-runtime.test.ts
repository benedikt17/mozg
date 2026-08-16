import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (path: string): string =>
  readFileSync(resolve(root, path), "utf8");

describe("Knowledge internal article link picker runtime", () => {
  it("uses the Knowledge tree instead of an article dropdown modal", () => {
    const editor = read("src/prototype/knowledge/markdown-source-editor.tsx");
    const sidebar = read("src/prototype/knowledge/knowledge-sidebar.tsx");
    const shell = read("src/prototype/desktop-shell.tsx");

    expect(editor).toContain("onBeginArticleLinkPick");
    expect(editor).toContain("openArticlePicker");
    expect(editor).not.toContain('setDialog("article")');
    expect(editor).not.toContain('<option value="">Выберите статью</option>');
    expect(sidebar).toContain("Выберите статью для ссылки");
    expect(sidebar).toContain("onPickLinkTarget?.(node.document.id)");
    expect(sidebar).toContain("onClick={toggleFolder}");
    expect(sidebar).toContain(
      "disabled={linkPickerSourceDocumentId === node.document.id}",
    );
    expect(shell).toContain("knowledgeArticleLinkPicker");
    expect(shell).toContain("pickKnowledgeArticleLinkTarget");
  });

  it("styles internal links as orange underlined links", () => {
    const css = read("src/prototype/desktop-knowledge.css");
    expect(css).toContain(".document-internal-link {");
    expect(css).toContain("color: #ff5200;");
    expect(css).toContain("text-decoration: underline;");
  });
});
