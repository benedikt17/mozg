from pathlib import Path

workspace = Path("src/prototype/files/files-workspace.tsx")
text = workspace.read_text()

old_variant = '''            if (!cancelled && variant) {
              objectUrl = URL.createObjectURL(variant.blob);
              setImageUrl(objectUrl);
              return;
            }'''
new_variant = '''            if (cancelled) return;
            if (variant) {
              objectUrl = URL.createObjectURL(variant.blob);
              setImageUrl(objectUrl);
              return;
            }'''
if old_variant not in text:
    raise SystemExit("variant cancellation marker missing")
text = text.replace(old_variant, new_variant, 1)

old_fallback = '''        const original = await repository.downloadFile({
          workspaceId,
          projectId,
          fileId: file.id,
        });'''
new_fallback = '''        if (cancelled) return;
        const original = await repository.downloadFile({
          workspaceId,
          projectId,
          fileId: file.id,
        });'''
if old_fallback not in text:
    raise SystemExit("original fallback marker missing")
text = text.replace(old_fallback, new_fallback, 1)

workspace.write_text(text)
