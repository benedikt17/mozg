import type { DesktopPrototypeState } from "@/prototype/desktop-state";
import { PrototypeButton } from "@/prototype/desktop-ui";
import { createKnowledgeBackup } from "./knowledge-backup-export";

export function KnowledgeBackupButton({
  state,
}: {
  state: DesktopPrototypeState;
}): React.JSX.Element {
  const downloadBackup = (): void => {
    const archive = createKnowledgeBackup(state);
    const zipBytes = new Uint8Array(archive.bytes);
    const blob = new Blob([zipBytes], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.download = archive.fileName;
    link.href = url;
    link.click();
    queueMicrotask(() => URL.revokeObjectURL(url));
  };

  return (
    <PrototypeButton
      aria-label="Скачать резервную копию всех Знаний"
      onClick={downloadBackup}
      size="compact"
      title="Скачать резервную копию всех Знаний"
      variant="quiet"
    >
      Backup
    </PrototypeButton>
  );
}
