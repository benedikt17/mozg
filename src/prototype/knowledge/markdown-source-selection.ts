export type MarkdownSelection = {
  start: number;
  end: number;
};

export type MarkdownToolbarFormatAction =
  | "h1"
  | "h2"
  | "h3"
  | "bold"
  | "italic"
  | "strike"
  | "inline-code"
  | "bullet"
  | "numbered"
  | "checklist"
  | "quote"
  | "code-block"
  | "horizontal-rule"
  | "indent"
  | "outdent";

export type MarkdownSelectionTransform = {
  markdown: string;
  selection: MarkdownSelection;
};

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

function replaceSelection(
  markdown: string,
  selection: MarkdownSelection,
  replacement: string,
  nextSelection: MarkdownSelection,
): MarkdownSelectionTransform {
  return {
    markdown:
      markdown.slice(0, selection.start) +
      replacement +
      markdown.slice(selection.end),
    selection: nextSelection,
  };
}

function wrapSelection(
  markdown: string,
  selection: MarkdownSelection,
  before: string,
  after: string,
  placeholder: string,
): MarkdownSelectionTransform {
  const selected = markdown.slice(selection.start, selection.end);
  const content = selected || placeholder;
  return replaceSelection(markdown, selection, `${before}${content}${after}`, {
    start: selection.start + before.length,
    end: selection.start + before.length + content.length,
  });
}

function prefixSelectedLines(
  markdown: string,
  selection: MarkdownSelection,
  prefixForLine: (line: string, index: number) => string,
): MarkdownSelectionTransform {
  const lineStart = markdown.lastIndexOf("\n", selection.start - 1) + 1;
  const nextLineBreak = markdown.indexOf("\n", selection.end);
  const lineEnd = nextLineBreak === -1 ? markdown.length : nextLineBreak;
  const replacement = markdown
    .slice(lineStart, lineEnd)
    .split("\n")
    .map(prefixForLine)
    .join("\n");
  return replaceSelection(
    markdown,
    { start: lineStart, end: lineEnd },
    replacement,
    {
      start: lineStart,
      end: lineStart + replacement.length,
    },
  );
}

export function applyMarkdownToolbarFormat(
  markdown: string,
  selectionStart: number,
  selectionEnd: number,
  action: MarkdownToolbarFormatAction,
): MarkdownSelectionTransform {
  const selection = { end: selectionEnd, start: selectionStart };

  if (action === "h1" || action === "h2" || action === "h3") {
    const level = Number(action.slice(1));
    return prefixSelectedLines(
      markdown,
      selection,
      (line) => `${"#".repeat(level)} ${line.replace(/^#{1,6}\s+/, "")}`,
    );
  }
  if (action === "bullet") {
    return prefixSelectedLines(
      markdown,
      selection,
      (line) => `- ${line.replace(/^[-*+]\s+/, "")}`,
    );
  }
  if (action === "numbered") {
    return prefixSelectedLines(
      markdown,
      selection,
      (line, index) => `${index + 1}. ${line.replace(/^\d+\.\s+/, "")}`,
    );
  }
  if (action === "checklist") {
    return prefixSelectedLines(
      markdown,
      selection,
      (line) => `- [ ] ${line.replace(/^- \[[ x]\]\s+/, "")}`,
    );
  }
  if (action === "quote") {
    return prefixSelectedLines(
      markdown,
      selection,
      (line) => `> ${line.replace(/^>\s+/, "")}`,
    );
  }
  if (action === "indent" || action === "outdent") {
    return prefixSelectedLines(markdown, selection, (line) =>
      adjustListIndent(line, action === "indent" ? 1 : -1),
    );
  }
  if (action === "bold") {
    return wrapSelection(markdown, selection, "**", "**", "текст");
  }
  if (action === "italic") {
    return wrapSelection(markdown, selection, "*", "*", "текст");
  }
  if (action === "strike") {
    return wrapSelection(markdown, selection, "~~", "~~", "текст");
  }
  if (action === "inline-code") {
    return wrapSelection(markdown, selection, "`", "`", "код");
  }
  if (action === "code-block") {
    return wrapSelection(markdown, selection, "```\n", "\n```", "код");
  }

  const prefix = selection.start > 0 ? "\n" : "";
  return replaceSelection(markdown, selection, `${prefix}---\n`, {
    start: selection.start + prefix.length + 4,
    end: selection.start + prefix.length + 4,
  });
}
