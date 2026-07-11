# Markdown pipeline

`MarkdownDocument` is an MDAST `Root` with structural `wikiLink` nodes and typed discovery metadata in `root.data.wikiLinks`. Both are derived, in-memory representations; persisted note content remains Markdown.

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

During parsing, semantic wiki-links are protected by deterministic, input-unique placeholders and then materialized as typed `wikiLink` nodes. The serializer emits only those structural nodes as wiki syntax. It never performs title matching or textual replacement, so identical escaped literals, repeated links, punctuation and code remain unambiguous.

`root.data.wikiLinks` is discovery metadata captured from the source. It is intentionally ignored during serialization: structural nodes are the serialization authority. If callers edit or reconstruct the tree, they must edit or recreate `wikiLink` nodes; stale metadata can never restore a link or modify unrelated text.
