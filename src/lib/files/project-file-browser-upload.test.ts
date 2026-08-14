import { describe, expect, it } from "vitest";

import { resolveProjectFileBrowserMimeType } from "./project-file-browser-upload";

describe("resolveProjectFileBrowserMimeType", () => {
  it("keeps supported browser MIME types", () => {
    expect(resolveProjectFileBrowserMimeType("photo.png", "image/png")).toBe(
      "image/png",
    );
  });

  it("infers Markdown when the browser leaves the MIME type empty", () => {
    expect(resolveProjectFileBrowserMimeType("notes.MD", "")).toBe(
      "text/markdown",
    );
  });

  it("infers Office Open XML MIME types from extensions", () => {
    expect(resolveProjectFileBrowserMimeType("brief.docx", "")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(resolveProjectFileBrowserMimeType("table.xlsx", "")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("rejects unsupported formats", () => {
    expect(resolveProjectFileBrowserMimeType("archive.zip", "application/zip")).toBe(
      null,
    );
  });
});
