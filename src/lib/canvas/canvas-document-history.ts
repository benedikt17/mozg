import {
  parseCanvasDocumentV2,
  type CanvasDocumentV2,
} from "@/lib/canvas/canvas-document";

const DEFAULT_CANVAS_HISTORY_LIMIT = 100;

function cloneDocument(document: CanvasDocumentV2): CanvasDocumentV2 {
  return structuredClone(document);
}

function sameDocument(
  first: CanvasDocumentV2,
  second: CanvasDocumentV2,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

export class CanvasDocumentHistory {
  private readonly limit: number;
  private past: CanvasDocumentV2[] = [];
  private future: CanvasDocumentV2[] = [];

  constructor(limit = DEFAULT_CANVAS_HISTORY_LIMIT) {
    this.limit = Math.max(1, Math.floor(limit));
  }

  reset(): void {
    this.past = [];
    this.future = [];
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  commit(previous: CanvasDocumentV2, next: CanvasDocumentV2): boolean {
    const validatedPrevious = parseCanvasDocumentV2(previous);
    const validatedNext = parseCanvasDocumentV2(next);
    if (sameDocument(validatedPrevious, validatedNext)) return false;
    this.past.push(cloneDocument(validatedPrevious));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    return true;
  }

  undo(current: CanvasDocumentV2): CanvasDocumentV2 | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(cloneDocument(parseCanvasDocumentV2(current)));
    if (this.future.length > this.limit) this.future.shift();
    return cloneDocument(previous);
  }

  redo(current: CanvasDocumentV2): CanvasDocumentV2 | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(cloneDocument(parseCanvasDocumentV2(current)));
    if (this.past.length > this.limit) this.past.shift();
    return cloneDocument(next);
  }
}
