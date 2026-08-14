from pathlib import Path
import re

workspace = Path("src/prototype/files/files-workspace.tsx")
text = workspace.read_text()
text = text.replace(
    "  chooseProjectFilePreviewVariant,\n  type ProjectFileImageVariantRepository,",
    "  chooseProjectFilePreviewVariant,\n  type ProjectFileImageVariantMetadata,\n  type ProjectFileImageVariantRepository,",
    1,
)
text = text.replace(
    "        let variants = [];",
    "        let variants: ProjectFileImageVariantMetadata[] = [];",
    1,
)
workspace.write_text(text)

e2e = Path("tests/e2e/files-desktop.spec.ts")
text = e2e.read_text()

# Use a real 800x600 PNG so at least edge-256 and edge-512 are useful tiers.
valid_png = "iVBORw0KGgoAAAANSUhEUgAAAyAAAAJYCAIAAAAVFBUnAAAIzUlEQVR42u3WMREAAAjEMMC/2JeACY4pkdCpnaQAALgzEgAAGCwAAIMFAGCwAAAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwDAYAEAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgCAwQIAwGABABgsAACDBQCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAAgwUAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgAABgsAwGABABgsAAAMFgCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAADBYAgMECADBYAAAYLAAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABABgsAAAMFgCAwQIAMFgAABgsAACDBQBgsAAAMFgAAAYLAMBgAQAYLAAADBYAgMECADBYAAAYLAAAgwUAYLAAADBYAAAGCwDAYAEAYLAAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwDAYAEAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAIDBAgAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgAABgsAwGABABgsAAAMFgCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAADBYAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAMFgAABgsAwGABABgsAAAMFgCAwQIAMFgAABgsAACDBQBgsAAAMFgAAAYLAMBgAQAYLAAADBYAgMECADBYAAAYLAAAgwUAYLAAADBYAAAGCwDAYAEAYLAAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQCAwQIAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwDAYAEAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgCAwQIAwGABABgsAACDBQCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAAgwUAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAIDBAgAwWAAABgsAAIMFAGCwAAAMFgAABgsAwGABABgsAAAMFgCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAADBYAgMECADBYAAAYLAAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABABgsAAAMFgCAwQIAMFgAABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECADBYAAAYLAAAgwUAYLAAADBYAAAGCwDAYAEAYLAAAAwWAIDBAgAwWBIAABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAYLAAADBYAAAGCwDAYAEAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAIDBAgAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQCAwQIAMFgAAAYLAACDBQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgAABgsAwGABABgsAACDBQCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAADBYAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAMCfBZlEB4Aye4RvAAAAAElFTkSuQmCC"
text, count = re.subn(
    r'(const PREVIEW_IMAGE_PNG = Buffer\.from\(\n\s+")[^"]+("\s*,\n\s+"base64",\n\);)',
    rf'\g<1>{valid_png}\g<2>',
    text,
    count=1,
)
if count != 1:
    raise SystemExit("PREVIEW_IMAGE_PNG marker missing")

# The storage SDK downloads with GET. Match the immutable storage path itself,
# not a particular Supabase URL prefix, so the test remains stable across local
# and hosted Storage endpoints.
text = text.replace(
    '      url.includes("/project-files/") &&\n      url.includes("/variants/edge-")',
    '      url.includes("/variants/edge-")',
    1,
)
text = text.replace(
    '      url.includes("/project-files/") &&\n      url.includes("/original")',
    '      url.includes("/original")',
    1,
)

old_preview_assertion = '''  await expect(preview.getByRole("img", { name: "preview-image.png" })).toBeVisible();
  expect(sawImageVariantDownload).toBe(true);
  expect(originalImageDownloadRequests).toBe(0);'''
new_preview_assertion = '''  const previewImage = preview.getByRole("img", { name: "preview-image.png" });
  await expect(previewImage).toBeVisible();
  await expect(previewImage).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() => sawImageVariantDownload, {
      message: "Files preview must GET a /variants/edge-* derivative",
      timeout: 10_000,
    })
    .toBe(true);
  expect(originalImageDownloadRequests).toBe(0);'''
if old_preview_assertion not in text:
    raise SystemExit("preview derivative assertion marker missing")
text = text.replace(old_preview_assertion, new_preview_assertion, 1)

old_original_assertion = "  expect(originalImageDownloadRequests).toBeGreaterThan(0);"
new_original_assertion = '''  await expect
    .poll(() => originalImageDownloadRequests, {
      message: "Explicit download must GET the immutable original",
      timeout: 10_000,
    })
    .toBeGreaterThan(0);'''
if old_original_assertion not in text:
    raise SystemExit("original download assertion marker missing")
text = text.replace(old_original_assertion, new_original_assertion, 1)

e2e.write_text(text)
