import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import {
  getKnowledgeHistoryShortcutAction,
  type KnowledgeContentHistoryOrigin,
} from "./knowledge-content-history";
import { useKnowledgeContentHistory } from "./knowledge-content-history-runtime";
import {
  adjustListIndent,
  applyMarkdownToolbarFormat,
  type MarkdownToolbarFormatAction,
} from "./markdown-source-selection";
export { adjustListIndent } from "./markdown-source-selection";

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
const listLinePattern = /^(\s*)(- \[[ xX]\]|- |\d+\. )(.*)$/;

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

function getInputOrigin(event: React.ChangeEvent<HTMLTextAreaElement>): {
  coalesce: boolean;
  origin: Exclude<KnowledgeContentHistoryOrigin, "baseline">;
} {
  const inputType = (event.nativeEvent as InputEvent).inputType;
  if (inputType === "insertFromPaste") {
    return { coalesce: false, origin: "paste" };
  }
  if (inputType === "deleteByCut") {
    return { coalesce: false, origin: "cut" };
  }
  if (inputType === "deleteContentBackward") {
    return { coalesce: true, origin: "backspace" };
  }
  if (inputType === "deleteContentForward") {
    return { coalesce: true, origin: "delete" };
  }
  if (
    inputType === "insertText" ||
    inputType === "insertLineBreak" ||
    inputType === "insertCompositionText"
  ) {
    return { coalesce: true, origin: "typing" };
  }
  return { coalesce: false, origin: "replace" };
}

export function MarkdownSourceEditor({
  document,
  documents = [],
}: {
  document: PrototypeDocument;
  documents?: PrototypeDocument[];
}): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const markdown = document.content.join("\n");
  const contentHistory = useKnowledgeContentHistory();
  const { getSelection, version } = contentHistory;
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
    const selection = getSelection(document.id);
    if (
      textarea &&
      selection !== null &&
      selection?.start !== null &&
      selection?.end !== null
    ) {
      textarea.setSelectionRange(selection.start, selection.end);
    }
  }, [getSelection, version, document.id, markdown, resizeTextarea]);

  const updateMarkdown = (
    nextMarkdown: string,
    options: {
      origin?: Exclude<KnowledgeContentHistoryOrigin, "baseline">;
      selectionStart?: number | null;
      selectionEnd?: number | null;
      coalesce?: boolean;
    } = {},
  ): void => {
    contentHistory.commitMarkdown(document.id, nextMarkdown, {
      coalesce: options.coalesce,
      origin: options.origin ?? "programmatic",
      selectionEnd: options.selectionEnd,
      selectionStart: options.selectionStart,
    });
  };

  const restoreSelection = (start: number, end = start): void => {
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
      textareaRef.current?.setSelectionRange(start, end);
    });
  };

  const adjustSelectedListLines = (
    delta: 1 | -1,
    origin: "toolbar" | "programmatic" = "toolbar",
  ): void => {
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
      {
        origin,
        selectionEnd: start + replacement.length,
        selectionStart: start,
      },
    );
    restoreSelection(start, start + replacement.length);
  };

  const applyAction = (action: MarkdownEditAction): void => {
    if (action === "undo") {
      contentHistory.undo(document.id);
      return;
    }
    if (action === "redo") {
      contentHistory.redo(document.id);
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (action === "link") {
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
    const result = applyMarkdownToolbarFormat(
      markdown,
      textarea.selectionStart,
      textarea.selectionEnd,
      action as MarkdownToolbarFormatAction,
    );
    updateMarkdown(result.markdown, {
      origin: "toolbar",
      selectionEnd: result.selection.end,
      selectionStart: result.selection.start,
    });
    restoreSelection(result.selection.start, result.selection.end);
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
      {
        origin: "toolbar",
        selectionEnd: selection.start + token.length,
        selectionStart: selection.start + token.length,
      },
    );
    setDialog(null);
    restoreSelection(selection.start + token.length);
  };

  const handleEditorKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    const textarea = event.currentTarget;
    const shortcut = getKnowledgeHistoryShortcutAction(event);
    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();
      if (shortcut === "undo") contentHistory.undo(document.id);
      else contentHistory.redo(document.id);
      return;
    }
    const lineStart =
      markdown.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const lineEnd = markdown.indexOf("\n", textarea.selectionStart);
    const end = lineEnd === -1 ? markdown.length : lineEnd;
    const line = markdown.slice(lineStart, end);
    if (event.key === "Tab") {
      event.preventDefault();
      adjustSelectedListLines(event.shiftKey ? -1 : 1, "programmatic");
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
          updateMarkdown(next, {
            origin: "programmatic",
            selectionEnd: lineStart + replacement.length,
            selectionStart: lineStart + replacement.length,
          });
          restoreSelection(lineStart + replacement.length);
        } else {
          const next =
            markdown.slice(0, textarea.selectionStart) +
            `\n${continuation}` +
            markdown.slice(textarea.selectionEnd);
          updateMarkdown(next, {
            origin: "programmatic",
            selectionEnd: textarea.selectionStart + 1 + continuation.length,
            selectionStart: textarea.selectionStart + 1 + continuation.length,
          });
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
        updateMarkdown(next, {
          origin: "programmatic",
          selectionEnd: Math.max(
            lineStart,
            textarea.selectionStart - LIST_INDENT,
          ),
          selectionStart: Math.max(
            lineStart,
            textarea.selectionStart - LIST_INDENT,
          ),
        });
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
          onFocus={() => contentHistory.activateContentScope(document.id)}
          onChange={(event) => {
            resizeTextarea(event.currentTarget);
            const input = getInputOrigin(event);
            updateMarkdown(event.currentTarget.value, {
              coalesce: input.coalesce,
              origin: input.origin,
              selectionEnd: event.currentTarget.selectionEnd,
              selectionStart: event.currentTarget.selectionStart,
            });
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
