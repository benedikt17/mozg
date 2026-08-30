import { describe, expect, it } from "vitest";

import {
  projectFileBrowserChecksum,
  resolveProjectFileBrowserMimeType,
} from "./project-file-browser-upload";

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
    expect(
      resolveProjectFileBrowserMimeType("archive.zip", "application/zip"),
    ).toBe(null);
  });

  it("uses a stable SHA-256 identity for the exact file contents", async () => {
    await expect(
      projectFileBrowserChecksum(new Blob(["same PDF bytes"])),
    ).resolves.toBe(
      "sha256:07dbe48c5da487890a8eeb3ec25e5aa88d1a490d6a696a77eca5c3719fdc4170",
    );
  });
});
