export type GoldenFixture = {
  name: string;
  input: string;
  expected: string;
};

export const goldenFixtures: GoldenFixture[] = [
  {
    name: "headings-and-paragraphs",
    input: "# Heading\n\nFirst paragraph.\n\nSecond paragraph.\n",
    expected: "# Heading\n\nFirst paragraph.\n\nSecond paragraph.\n",
  },
  {
    name: "russian-cyrillic",
    input: "## Русский текст\n\nПривет, мир — важная заметка.\n",
    expected: "## Русский текст\n\nПривет, мир — важная заметка.\n",
  },
  {
    name: "english-text",
    input: "## English text\n\nA portable Markdown note.\n",
    expected: "## English text\n\nA portable Markdown note.\n",
  },
  {
    name: "inline-formatting",
    input: "Use **bold** and *italic* text together.\n",
    expected: "Use **bold** and *italic* text together.\n",
  },
  {
    name: "links-and-images",
    input:
      "[OpenAI](https://openai.com) and ![alt](https://example.com/image.png).\n",
    expected:
      "[OpenAI](https://openai.com) and ![alt](https://example.com/image.png).\n",
  },
  {
    name: "inline-code",
    input: "Call `parseMarkdown(value)` without changing `value`.\n",
    expected: "Call `parseMarkdown(value)` without changing `value`.\n",
  },
  {
    name: "fenced-code-block",
    input: '```ts\nconst value = "[[not-a-link]]";\n```\n',
    expected: '```ts\nconst value = "[[not-a-link]]";\n```\n',
  },
  {
    name: "unordered-nested-list",
    input: "- first\n  - nested\n  - nested two\n- second\n",
    expected: "- first\n  - nested\n  - nested two\n- second\n",
  },
  {
    name: "ordered-list",
    input: "1. first\n2. second\n3. third\n",
    expected: "1. first\n2. second\n3. third\n",
  },
  {
    name: "task-list",
    input: "- [ ] open\n- [x] done\n",
    expected: "- [ ] open\n- [x] done\n",
  },
  {
    name: "task-uuid",
    input: "- [ ] Купить молоко ^task-550e8400-e29b-41d4-a716-446655440000\n",
    expected:
      "- [ ] Купить молоко ^task-550e8400-e29b-41d4-a716-446655440000\n",
  },
  {
    name: "wiki-link",
    input: "Открыть [[Название заметки]] сегодня.\n",
    expected: "Открыть [[Название заметки]] сегодня.\n",
  },
  {
    name: "wiki-link-special-characters",
    input: "Ссылка: [[API & интеграции — 2026!]]; рядом (скобки).\n",
    expected: "Ссылка: [[API & интеграции — 2026!]]; рядом (скобки).\n",
  },
  {
    name: "mixed-language",
    input: "Русский text и `technical_identifier` в одной строке.\n",
    expected: "Русский text и `technical_identifier` в одной строке.\n",
  },
  {
    name: "raw-html-supported-unknown",
    input:
      '<details data-kind="custom">\n<summary>Unknown supported block</summary>\nBody\n</details>\n',
    expected:
      '<details data-kind="custom">\n<summary>Unknown supported block</summary>\nBody\n</details>\n',
  },
  {
    name: "crlf-input",
    input: "# CRLF\r\n\r\nWindows line endings.\r\n",
    expected: "# CRLF\n\nWindows line endings.\n",
  },
  {
    name: "missing-trailing-newline",
    input: "Document without trailing newline",
    expected: "Document without trailing newline\n",
  },
  {
    name: "empty-document",
    input: "",
    expected: "",
  },
  {
    name: "malformed-task-marker",
    input: "- [ ] malformed ^task-not-a-uuid\n",
    expected: "- [ ] malformed ^task-not-a-uuid\n",
  },
  {
    name: "duplicate-task-id",
    input:
      "- [ ] first ^task-550e8400-e29b-41d4-a716-446655440000\n- [x] second ^task-550e8400-e29b-41d4-a716-446655440000\n",
    expected:
      "- [ ] first ^task-550e8400-e29b-41d4-a716-446655440000\n- [x] second ^task-550e8400-e29b-41d4-a716-446655440000\n",
  },
];
