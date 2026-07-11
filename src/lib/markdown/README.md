# Markdown pipeline

`MarkdownDocument` is an MDAST `Root` with typed wiki-link metadata in `root.data.wikiLinks`. The metadata lets the serializer distinguish semantic wiki-links from escaped literal brackets. It is a derived, in-memory representation; persisted note content remains Markdown.

## Canonicalization

The serializer intentionally applies only deterministic formatting rules:

- line endings become LF;
- a non-empty document ends with exactly one newline; an empty document stays empty;
- headings use ATX syntax;
- unordered lists use `-` and one-space indentation;
- emphasis and strong markers use `*` / `**`;
- code blocks use fenced syntax;
- GFM task markers, task UUID suffixes, wiki-links, raw HTML and other supported content are preserved.

No global `trim()` is applied. Whitespace changes are owned by the MDAST serializer and covered by explicit golden expectations.

## Task references

Only a list item with one valid final `^task-<uuid>` marker is a task reference. Ordinary checkboxes and malformed or multi-ID lines are ignored. All duplicate occurrences are returned and marked with `isDuplicate: true`; `occurrence` is one-based. IDs are returned in lowercase. The parser never creates an ID.

## Wiki-links

`[[Title]]` is extracted outside fenced and inline code. Escaped links and empty or nested-bracket targets are ignored. Titles are trimmed for lookup while `raw` preserves the matched source.
