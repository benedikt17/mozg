import React, { useCallback, useLayoutEffect, useRef } from "react";
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
  | "horizontal-rule";

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
];

export function MarkdownSourceEditor({
  document,
  dispatch,
}: {
  document: PrototypeDocument;
  dispatch: Dispatch;
}): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const markdown = document.content.join("\n");
  const historyRef = useRef<string[]>([markdown]);
  const historyIndexRef = useRef(0);
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

  const applyAction = (action: MarkdownEditAction): void => {
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
    if (action === "link") wrapSelection("[", "](https://)", "ссылка");
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
      </div>
      <div className="markdown-source-content">
        <textarea
          aria-label={`Markdown: ${document.title}`}
          className="markdown-source-textarea"
          onChange={(event) => {
            resizeTextarea(event.currentTarget);
            updateMarkdown(event.currentTarget.value);
          }}
          ref={mountTextarea}
          spellCheck
          value={markdown}
        />
      </div>
    </div>
  );
}
