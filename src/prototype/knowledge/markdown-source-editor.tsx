import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeAction } from "@/prototype/desktop-state";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

type MarkdownEditAction =
  | "undo"
  | "redo"
  | "h1"
  | "h2"
  | "h3"
  | "bold"
  | "italic"
  | "strike"
  | "inline-code"
  | "link"
  | "bullet"
  | "numbered"
  | "checklist"
  | "quote"
  | "code-block"
  | "horizontal-rule"
  | "indent"
  | "outdent";

const LIST_INDENT = 4;
const MAX_LIST_INDENT = 8;
const listLinePattern = /^(\s*)(- \[[ xX]\]|- |\d+\. )(.*)$/;

export function adjustListIndent(line: string, delta: 1 | -1): string {
  const match = listLinePattern.exec(line);
  if (!match) return line;
  const depth = Math.min(
    MAX_LIST_INDENT,
    Math.max(0, match[1]!.length + delta * LIST_INDENT),
  );
  return `${" ".repeat(depth)}${match[2]}${match[3]}`;
}

export function continueListLine(line: string): string | null {
  const match = listLinePattern.exec(line);
  if (!match) return null;
  const indent = match[1]!;
  if (match[3]!.trim() === "") return indent;
  if (match[2]!.startsWith("- [")) return `${indent}- [ ] `;
  if (match[2] === "- ") return `${indent}- `;
  return `${indent}${Number.parseInt(match[2]!, 10) + 1}. `;
}

const markdownToolbarActions: Array<{
  action: MarkdownEditAction;
  label: string;
  title: string;
}> = [
  { action: "undo", label: "↶", title: "Отменить" },
  { action: "redo", label: "↷", title: "Повторить" },
  { action: "h1", label: "H1", title: "Заголовок 1" },
  { action: "h2", label: "H2", title: "Заголовок 2" },
  { action: "h3", label: "H3", title: "Заголовок 3" },
  { action: "bold", label: "B", title: "Жирный" },
  { action: "italic", label: "I", title: "Курсив" },
  { action: "strike", label: "S", title: "Зачёркнутый" },
  { action: "inline-code", label: "`", title: "Встроенный код" },
  { action: "link", label: "↗", title: "Ссылка" },
  { action: "bullet", label: "•", title: "Маркированный список" },
  { action: "numbered", label: "1.", title: "Нумерованный список" },
  { action: "checklist", label: "☐", title: "Чек-лист" },
  { action: "quote", label: "❯", title: "Цитата" },
  { action: "code-block", label: "{}", title: "Блок кода" },
  { action: "horizontal-rule", label: "—", title: "Горизонтальная линия" },
  { action: "indent", label: "→", title: "Увеличить отступ" },
  { action: "outdent", label: "←", title: "Уменьшить отступ" },
];

export function MarkdownSourceEditor({
  document,
  dispatch,
  documents = [],
}: {
  document: PrototypeDocument;
  dispatch: Dispatch;
  documents?: PrototypeDocument[];
}): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const markdown = document.content.join("\n");
  const historyRef = useRef<string[]>([markdown]);
  const historyIndexRef = useRef(0);
  const [dialog, setDialog] = useState<"external" | "article" | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [linkText, setLinkText] = useState("");
  const [url, setUrl] = useState("");
  const [articleId, setArticleId] = useState("");
  const addressRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (dialog === "external") addressRef.current?.focus();
  }, [dialog]);
  const resizeTextarea = useCallback((textarea: HTMLTextAreaElement): void => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);
  const mountTextarea = useCallback(
    (textarea: HTMLTextAreaElement | null) => {
      textareaRef.current = textarea;
      if (!textarea) return;
      resizeTextarea(textarea);
      textarea.focus({ preventScroll: true });
    },
    [resizeTextarea],
  );

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) resizeTextarea(textarea);
  }, [markdown, resizeTextarea]);

  const updateMarkdown = (nextMarkdown: string, addToHistory = true): void => {
    if (addToHistory) {
      const history = historyRef.current.slice(0, historyIndexRef.current + 1);
      if (history[history.length - 1] !== nextMarkdown) {
        history.push(nextMarkdown);
        historyRef.current = history;
        historyIndexRef.current = history.length - 1;
      }
    }
    dispatch({
      type: "update-knowledge-document-markdown",
      documentId: document.id,
      markdown: nextMarkdown,
    });
  };

  const restoreSelection = (start: number, end = start): void => {
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
      textareaRef.current?.setSelectionRange(start, end);
    });
  };

  const replaceSelection = (
    replacement: string,
    selectionStart: number,
    selectionEnd: number,
  ): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const next =
      markdown.slice(0, textarea.selectionStart) +
      replacement +
      markdown.slice(textarea.selectionEnd);
    updateMarkdown(next);
    restoreSelection(selectionStart, selectionEnd);
  };

  const wrapSelection = (
    before: string,
    after: string,
    placeholder: string,
  ): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selected = markdown.slice(
      textarea.selectionStart,
      textarea.selectionEnd,
    );
    const content = selected || placeholder;
    const replacement = `${before}${content}${after}`;
    const start = textarea.selectionStart + before.length;
    replaceSelection(replacement, start, start + content.length);
  };

  const prefixSelectedLines = (
    prefixForLine: (line: string, index: number) => string,
  ): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const lineStart =
      markdown.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const nextLineBreak = markdown.indexOf("\n", textarea.selectionEnd);
    const lineEnd = nextLineBreak === -1 ? markdown.length : nextLineBreak;
    const replacement = markdown
      .slice(lineStart, lineEnd)
      .split("\n")
      .map(prefixForLine)
      .join("\n");
    const next =
      markdown.slice(0, lineStart) + replacement + markdown.slice(lineEnd);
    updateMarkdown(next);
    restoreSelection(lineStart, lineStart + replacement.length);
  };

  const adjustSelectedListLines = (delta: 1 | -1): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = markdown.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const endBreak = markdown.indexOf("\n", textarea.selectionEnd);
    const end = endBreak === -1 ? markdown.length : endBreak;
    const replacement = markdown
      .slice(start, end)
      .split("\n")
      .map((line) => adjustListIndent(line, delta))
      .join("\n");
    updateMarkdown(
      markdown.slice(0, start) + replacement + markdown.slice(end),
    );
    restoreSelection(start, start + replacement.length);
  };

  const applyAction = (action: MarkdownEditAction): void => {
    if (action === "indent") return adjustSelectedListLines(1);
    if (action === "outdent") return adjustSelectedListLines(-1);
    if (action === "undo") {
      if (historyIndexRef.current === 0) return;
      historyIndexRef.current -= 1;
      const previous = historyRef.current[historyIndexRef.current] ?? "";
      updateMarkdown(previous, false);
      return;
    }
    if (action === "redo") {
      if (historyIndexRef.current >= historyRef.current.length - 1) return;
      historyIndexRef.current += 1;
      const next = historyRef.current[historyIndexRef.current] ?? "";
      updateMarkdown(next, false);
      return;
    }
    if (action === "h1" || action === "h2" || action === "h3") {
      const level = Number(action.slice(1));
      prefixSelectedLines(
        (line) => `${"#".repeat(level)} ${line.replace(/^#{1,6}\s+/, "")}`,
      );
      return;
    }
    if (action === "bullet") {
      prefixSelectedLines((line) => `- ${line.replace(/^[-*+]\s+/, "")}`);
      return;
    }
    if (action === "numbered") {
      prefixSelectedLines(
        (line, index) => `${index + 1}. ${line.replace(/^\d+\.\s+/, "")}`,
      );
      return;
    }
    if (action === "checklist") {
      prefixSelectedLines(
        (line) => `- [ ] ${line.replace(/^- \[[ x]\]\s+/, "")}`,
      );
      return;
    }
    if (action === "quote") {
      prefixSelectedLines((line) => `> ${line.replace(/^>\s+/, "")}`);
      return;
    }
    if (action === "bold") wrapSelection("**", "**", "текст");
    if (action === "italic") wrapSelection("*", "*", "текст");
    if (action === "strike") wrapSelection("~~", "~~", "текст");
    if (action === "inline-code") wrapSelection("`", "`", "код");
    if (action === "link") {
      const textarea = textareaRef.current;
      if (!textarea) return;
      setSelection({
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      });
      setLinkText(
        markdown.slice(textarea.selectionStart, textarea.selectionEnd),
      );
      setUrl("");
      setDialog("external");
      return;
    }
    if (action === "code-block") wrapSelection("```\n", "\n```", "код");
    if (action === "horizontal-rule") {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const prefix = textarea.selectionStart > 0 ? "\n" : "";
      replaceSelection(
        `${prefix}---\n`,
        textarea.selectionStart + prefix.length + 4,
        textarea.selectionStart + prefix.length + 4,
      );
    }
  };

  const openArticleDialog = (): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setSelection({
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
    setLinkText(markdown.slice(textarea.selectionStart, textarea.selectionEnd));
    setArticleId("");
    setDialog("article");
  };

  const insertLink = (): void => {
    const label = linkText.trim();
    const target = dialog === "external" ? url.trim() : articleId;
    if (
      !label ||
      !target ||
      (dialog === "external" && !/^https?:\/\//i.test(target))
    )
      return;
    const token =
      dialog === "external"
        ? `[${label}](${target})`
        : `[[doc:${target}|${label}]]`;
    updateMarkdown(
      markdown.slice(0, selection.start) +
        token +
        markdown.slice(selection.end),
    );
    setDialog(null);
    restoreSelection(selection.start + token.length);
  };

  const handleEditorKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    const textarea = event.currentTarget;
    const lineStart =
      markdown.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const lineEnd = markdown.indexOf("\n", textarea.selectionStart);
    const end = lineEnd === -1 ? markdown.length : lineEnd;
    const line = markdown.slice(lineStart, end);
    if (event.key === "Tab") {
      event.preventDefault();
      adjustSelectedListLines(event.shiftKey ? -1 : 1);
      return;
    }
    if (
      event.key === "Enter" &&
      textarea.selectionStart === textarea.selectionEnd
    ) {
      const continuation = continueListLine(line);
      if (continuation !== null) {
        event.preventDefault();
        const content = line
          .replace(/^\s*/, "")
          .replace(listLinePattern, "$3")
          .trim();
        if (!content) {
          const depth = (line.match(/^\s*/) ?? [""])[0].length;
          const nextIndent = Math.max(0, depth - LIST_INDENT);
          const replacement = nextIndent ? " ".repeat(nextIndent) : "";
          const next =
            markdown.slice(0, lineStart) + replacement + markdown.slice(end);
          updateMarkdown(next);
          restoreSelection(lineStart + replacement.length);
        } else {
          const next =
            markdown.slice(0, textarea.selectionStart) +
            `\n${continuation}` +
            markdown.slice(textarea.selectionEnd);
          updateMarkdown(next);
          restoreSelection(textarea.selectionStart + 1 + continuation.length);
        }
        return;
      }
    }
    if (
      event.key === "Backspace" &&
      textarea.selectionStart === textarea.selectionEnd &&
      textarea.selectionStart === lineStart
    ) {
      const indent = line.match(/^\s*/)?.[0] ?? "";
      if (indent.length > 0 && listLinePattern.test(line)) {
        event.preventDefault();
        const next =
          markdown.slice(0, lineStart) +
          adjustListIndent(line, -1) +
          markdown.slice(end);
        updateMarkdown(next);
        restoreSelection(
          Math.max(lineStart, textarea.selectionStart - LIST_INDENT),
        );
      }
    }
  };

  return (
    <div className="markdown-source-editor">
      <div className="markdown-toolbar" aria-label="Форматирование Markdown">
        {markdownToolbarActions.map((item) => (
          <button
            aria-label={item.title}
            className="markdown-toolbar-button"
            key={item.action}
            onClick={() => applyAction(item.action)}
            onMouseDown={(event) => event.preventDefault()}
            title={item.title}
            type="button"
          >
            {item.label}
          </button>
        ))}
        <button
          aria-label="Внешняя ссылка"
          className="markdown-toolbar-button"
          onClick={() => applyAction("link")}
          onMouseDown={(event) => event.preventDefault()}
          title="Внешняя ссылка"
          type="button"
        >
          ↗
        </button>
        <button
          aria-label="Ссылка на статью"
          className="markdown-toolbar-button"
          onClick={openArticleDialog}
          onMouseDown={(event) => event.preventDefault()}
          title="Ссылка на статью"
          type="button"
        >
          ◈
        </button>
      </div>
      {dialog
        ? createPortal(
            <div className="markdown-link-portal-theme">
              <div
                className="markdown-link-overlay"
                role="presentation"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setDialog(null);
                  }
                }}
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setDialog(null);
                }}
              >
                <div
                  aria-labelledby="markdown-link-dialog-title"
                  aria-modal="true"
                  className="markdown-link-modal-card"
                  role="dialog"
                >
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      insertLink();
                    }}
                  >
                    <h3 id="markdown-link-dialog-title">
                      {dialog === "external"
                        ? "Добавить внешнюю ссылку"
                        : "Ссылка на статью"}
                    </h3>
                    <label htmlFor="markdown-link-text">Текст</label>
                    <input
                      id="markdown-link-text"
                      value={linkText}
                      onChange={(event) =>
                        setLinkText(event.currentTarget.value)
                      }
                    />
                    <label htmlFor="markdown-link-target">
                      {dialog === "external" ? "Адрес" : "Статья"}
                    </label>
                    {dialog === "external" ? (
                      <input
                        id="markdown-link-target"
                        ref={addressRef}
                        placeholder="https://…"
                        value={url}
                        onChange={(event) => setUrl(event.currentTarget.value)}
                      />
                    ) : (
                      <select
                        id="markdown-link-target"
                        autoFocus
                        value={articleId}
                        onChange={(event) => {
                          setArticleId(event.currentTarget.value);
                          const item = documents.find(
                            (entry) => entry.id === event.currentTarget.value,
                          );
                          if (item && !linkText) setLinkText(item.title);
                        }}
                      >
                        <option value="">Выберите статью</option>
                        {documents
                          .filter(
                            (item) =>
                              item.id !== document.id &&
                              item.projectId === document.projectId,
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.title}
                            </option>
                          ))}
                      </select>
                    )}
                    <div className="markdown-link-dialog-actions">
                      <button type="button" onClick={() => setDialog(null)}>
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={
                          !linkText.trim() ||
                          !(dialog === "external"
                            ? /^https?:\/\//i.test(url.trim())
                            : articleId)
                        }
                      >
                        Добавить
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>,
            window.document.body,
          )
        : null}
      <div className="markdown-source-content">
        <textarea
          aria-label={`Markdown: ${document.title}`}
          className="markdown-source-textarea"
          onChange={(event) => {
            resizeTextarea(event.currentTarget);
            updateMarkdown(event.currentTarget.value);
          }}
          onKeyDown={handleEditorKeyDown}
          ref={mountTextarea}
          spellCheck
          value={markdown}
        />
      </div>
    </div>
  );
}
