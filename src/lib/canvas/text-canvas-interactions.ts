import {
  extractCanvasImageTransfer,
  type CanvasImageTransferPayload,
} from "@/lib/canvas/canvas-image-ingestion";

export function extractCanvasPlainText(
  payload: CanvasImageTransferPayload,
  plainText: string,
): string {
  const imageTransfer = extractCanvasImageTransfer(payload, "clipboard");
  if (imageTransfer.candidates.length > 0) return "";
  return plainText;
}

export function plainTextFromClipboard(event: ClipboardEvent): string {
  const payload: CanvasImageTransferPayload = {
    items: event.clipboardData ? Array.from(event.clipboardData.items) : [],
    files: event.clipboardData ? Array.from(event.clipboardData.files) : [],
    types: event.clipboardData ? Array.from(event.clipboardData.types) : [],
  };
  if (extractCanvasImageTransfer(payload, "clipboard").candidates.length > 0) {
    return "";
  }
  return event.clipboardData?.getData("text/plain") ?? "";
}

export function hasMeaningfulPlainText(value: string): boolean {
  return value.trim().length > 0;
}

export function createCanvasTextId(
  idGenerator: () => string = () => crypto.randomUUID(),
): string {
  return `text-${idGenerator()}`;
}

export function commitTextMarkdown(value: string): string {
  return value.slice(0, 250_000);
}
