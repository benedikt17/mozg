from pathlib import Path
import re

workspace = Path("src/prototype/files/files-workspace.tsx")
text = workspace.read_text()

old_import = 'import { SupabaseProjectFileRepository } from "@/lib/files/cloud-project-file-repository";\n'
new_import = '''import { SupabaseProjectFileImageVariantRepository } from "@/lib/files/cloud-project-file-image-variant-repository";
import { SupabaseProjectFileRepository } from "@/lib/files/cloud-project-file-repository";
import { generateAndStoreProjectFileImageVariantsBestEffort } from "@/lib/files/project-file-image-variant-generation";
import {
  chooseProjectFilePreviewVariant,
  type ProjectFileImageVariantRepository,
} from "@/lib/files/project-file-image-variants";
'''
if old_import not in text:
    raise SystemExit("workspace import marker not found")
text = text.replace(old_import, new_import, 1)
text = text.replace('  type ProjectFileDownload,\n', '', 1)

old_repo = '''  const repository = useMemo(() => {
    const env = getPublicEnv();
    return new SupabaseProjectFileRepository({
      supabase: createClient(),
      resumableUploadEndpoint: projectFileResumableUploadEndpoint(
        env.NEXT_PUBLIC_SUPABASE_URL,
      ),
    });
  }, []);'''
new_repo = '''  const { repository, imageVariantRepository } = useMemo(() => {
    const env = getPublicEnv();
    const supabase = createClient();
    return {
      repository: new SupabaseProjectFileRepository({
        supabase,
        resumableUploadEndpoint: projectFileResumableUploadEndpoint(
          env.NEXT_PUBLIC_SUPABASE_URL,
        ),
      }),
      imageVariantRepository: new SupabaseProjectFileImageVariantRepository(
        supabase,
      ),
    };
  }, []);'''
if old_repo not in text:
    raise SystemExit("workspace repository marker not found")
text = text.replace(old_repo, new_repo, 1)

completed_marker = '        completedCount += 1;\n'
if completed_marker not in text:
    raise SystemExit("upload completion marker not found")
variant_generation = '''        await generateAndStoreProjectFileImageVariantsBestEffort({
          repository: imageVariantRepository,
          file: uploaded,
          sourceBlob: prepared.blob,
          signal: abortController.signal,
        });
'''
text = text.replace(completed_marker, variant_generation + completed_marker, 1)

preview_call_marker = '''              onRename={renameFile}
              projectId={projectId}
              repository={repository}
              workspaceId={workspaceId}'''
preview_call_replacement = '''              onRename={renameFile}
              projectId={projectId}
              repository={repository}
              imageVariantRepository={imageVariantRepository}
              workspaceId={workspaceId}'''
if preview_call_marker not in text:
    raise SystemExit("preview call marker not found")
text = text.replace(preview_call_marker, preview_call_replacement, 1)

signature_marker = '''function ProjectFilePreview({
  repository,
  workspaceId,'''
signature_replacement = '''function ProjectFilePreview({
  repository,
  imageVariantRepository,
  workspaceId,'''
if signature_marker not in text:
    raise SystemExit("preview signature marker not found")
text = text.replace(signature_marker, signature_replacement, 1)

props_marker = '''}: {
  repository: ProjectFileRepository;
  workspaceId: string;'''
props_replacement = '''}: {
  repository: ProjectFileRepository;
  imageVariantRepository: ProjectFileImageVariantRepository;
  workspaceId: string;'''
if props_marker not in text:
    raise SystemExit("preview props marker not found")
text = text.replace(props_marker, props_replacement, 1)

state_start = text.find('  const [download, setDownload] = useState<ProjectFileDownload | null>(null);')
return_marker = '  return (\n    <div className={styles.previewContent}>'
state_end = text.find(return_marker, state_start)
if state_start < 0 or state_end < 0:
    raise SystemExit("preview state/effect region not found")
new_preview_logic = '''  const [loadError, setLoadError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [downloadingOriginal, setDownloadingOriginal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(file.name);
  const [targetFolderId, setTargetFolderId] = useState(file.folderId ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isImage = file.mimeType.startsWith("image/");

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        let variants = [];
        try {
          variants = await imageVariantRepository.listImageVariants({
            workspaceId,
            projectId,
            fileId: file.id,
          });
        } catch {
          // Variant cache is optional. A ready original remains the fallback.
        }
        const preferred = chooseProjectFilePreviewVariant(variants);
        if (preferred) {
          try {
            const variant = await imageVariantRepository.loadImageVariant({
              workspaceId,
              projectId,
              fileId: file.id,
              targetMaxEdge: preferred.targetMaxEdge,
            });
            if (!cancelled && variant) {
              objectUrl = URL.createObjectURL(variant.blob);
              setImageUrl(objectUrl);
              return;
            }
          } catch {
            // A stale/missing disposable derivative falls back to the original.
          }
        }

        const original = await repository.downloadFile({
          workspaceId,
          projectId,
          fileId: file.id,
        });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(original.blob);
        setImageUrl(objectUrl);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    file.id,
    imageVariantRepository,
    isImage,
    projectId,
    repository,
    workspaceId,
  ]);

  const downloadOriginal = async () => {
    if (downloadingOriginal) return;
    setDownloadingOriginal(true);
    try {
      const download = await repository.downloadFile({
        workspaceId,
        projectId,
        fileId: file.id,
      });
      const objectUrl = URL.createObjectURL(download.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.originalName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingOriginal(false);
    }
  };

'''
text = text[:state_start] + new_preview_logic + text[state_end:]

old_placeholder = '''      <div className={styles.previewPlaceholder}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview uses a local authenticated Blob URL.
          <img alt={file.name} className={styles.previewImage} src={imageUrl} />
        ) : loadError ? (
          <span className={styles.previewState}>Предпросмотр недоступен</span>
        ) : download ? (
          <UiIcon name="file" />
        ) : (
          <span className={styles.previewState}>Загрузка предпросмотра…</span>
        )}
      </div>'''
new_placeholder = '''      <div className={styles.previewPlaceholder}>
        {isImage ? (
          imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview uses a local authenticated Blob URL.
            <img alt={file.name} className={styles.previewImage} src={imageUrl} />
          ) : loadError ? (
            <span className={styles.previewState}>Предпросмотр недоступен</span>
          ) : (
            <span className={styles.previewState}>Загрузка предпросмотра…</span>
          )
        ) : (
          <UiIcon name="file" />
        )}
      </div>'''
if old_placeholder not in text:
    raise SystemExit("preview placeholder marker not found")
text = text.replace(old_placeholder, new_placeholder, 1)

old_download_button = '''        <PrototypeButton
          disabled={!download}
          onClick={downloadOriginal}
          size="compact"
          variant="default"
        >
          Скачать оригинал
        </PrototypeButton>'''
new_download_button = '''        <PrototypeButton
          disabled={downloadingOriginal}
          onClick={() => void downloadOriginal()}
          size="compact"
          variant="default"
        >
          {downloadingOriginal ? "Скачивание…" : "Скачать оригинал"}
        </PrototypeButton>'''
if old_download_button not in text:
    raise SystemExit("download button marker not found")
text = text.replace(old_download_button, new_download_button, 1)

workspace.write_text(text)

# Strengthen browser acceptance: a newly uploaded image must generate and load
# a derivative before the original is explicitly downloaded.
e2e = Path("tests/e2e/files-desktop.spec.ts")
text = e2e.read_text()

const_marker = 'import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";\n'
png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAyAAAAJYCAIAAAAVFBUnAAAIz0lEQVR42u3WMREAMAgAsVKFyEEYAjHBMSUSfvroygcAwJ4vAQCAwAYIAMBgAQAYLAAADBYAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABABgsAAAMFgCAwQIAMFgAABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAYLAAADBYAAAGCwDAYAEAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAGCwAAAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQCAwQIAMFgAAAYLAACDBQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwAAgwUAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgAABgsAwGABABgsAACDBQCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAADBYAgMECADBYAAAYLAAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABABgsAAAMFgCAwQIAMFgAABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAYLAAADBYAAAGCwDAYAEAYLAAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwAAgwUAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgAABgsAwGABABgsAACDBQCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAAgyUBAIDBAgAwWAAABgsAAIMFAGCwAAAMFgAABgsAwGABABgsAAAMFgCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAADBYAgMECADBYAAAYLAAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABABgsAAAMFgCAwQIAMFgAABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECADBYAAAYLAAAgwUAYLAAADBYAAAGCwDAYAEAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAGCwAAAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABANwZFXMGLDb03j4AAAAASUVORK5CYII="
const_block = const_marker + f'\nconst PREVIEW_IMAGE_PNG = Buffer.from(\n  "{png_base64}",\n  "base64",\n);\n'
if const_marker not in text:
    raise SystemExit("E2E const marker not found")
text = text.replace(const_marker, const_block, 1)

listener_old = '''  let sawResumableUpload = false;
  page.on("request", (request) => {
    if (request.url().includes("/storage/v1/upload/resumable")) {
      sawResumableUpload = true;
    }
  });'''
listener_new = '''  let sawResumableUpload = false;
  let sawImageVariantDownload = false;
  let originalImageDownloadRequests = 0;
  page.on("request", (request) => {
    const url = decodeURIComponent(request.url());
    if (url.includes("/storage/v1/upload/resumable")) {
      sawResumableUpload = true;
    }
    if (
      request.method() === "GET" &&
      url.includes("/project-files/") &&
      url.includes("/variants/edge-")
    ) {
      sawImageVariantDownload = true;
    }
    if (
      request.method() === "GET" &&
      url.includes("/project-files/") &&
      url.includes("/original")
    ) {
      originalImageDownloadRequests += 1;
    }
  });'''
if listener_old not in text:
    raise SystemExit("E2E request listener marker not found")
text = text.replace(listener_old, listener_new, 1)

text = text.replace('name: "pixel.gif"', 'name: "preview-image.png"', 1)
text = text.replace('mimeType: "image/gif"', 'mimeType: "image/png"', 1)
text, count = re.subn(
    r'buffer: Buffer\.from\(\n\s+"R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",\n\s+"base64",\n\s+\),',
    'buffer: PREVIEW_IMAGE_PNG,',
    text,
    count=1,
)
if count != 1:
    raise SystemExit("E2E GIF fixture marker not found")
text = text.replace('"pixel.gif"', '"preview-image.png"')
text = text.replace('/pixel\\.gif/', '/preview-image\\.png/')

img_expect = '''  await expect(preview.getByRole("img", { name: "preview-image.png" })).toBeVisible();'''
if img_expect not in text:
    raise SystemExit("E2E image preview expectation marker not found")
text = text.replace(
    img_expect,
    img_expect + '''
  expect(sawImageVariantDownload).toBe(true);
  expect(originalImageDownloadRequests).toBe(0);''',
    1,
)

download_wait = '''  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("preview-image.png");'''
if download_wait not in text:
    raise SystemExit("E2E download assertion marker not found")
text = text.replace(
    download_wait,
    download_wait + '''
  expect(originalImageDownloadRequests).toBeGreaterThan(0);''',
    1,
)

e2e.write_text(text)
