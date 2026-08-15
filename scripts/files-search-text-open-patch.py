from pathlib import Path

path = Path("src/prototype/files/files-workspace.tsx")
text = path.read_text()
old = '''      const objectUrl = URL.createObjectURL(download.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.target = "_blank";
'''
new = '''      const browserBlob =
        file.mimeType.startsWith("text/") || file.mimeType === "application/json"
          ? new Blob([download.blob], {
              type: `${file.mimeType};charset=utf-8`,
            })
          : download.blob;
      const objectUrl = URL.createObjectURL(browserBlob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.target = "_blank";
'''
if old not in text:
    raise SystemExit("openOriginal Blob anchor missing")
path.write_text(text.replace(old, new, 1))
