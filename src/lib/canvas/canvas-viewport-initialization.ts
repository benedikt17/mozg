export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type CanvasViewportInitialization = {
  canvasId: string;
  generation: number;
  viewport: CanvasViewport;
};

export type AnimationFrameScheduler = {
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
};

const VIEWPORT_EPSILON = 0.0001;

export function viewportMatches(
  current: CanvasViewport,
  expected: CanvasViewport,
): boolean {
  return (
    Math.abs(current.x - expected.x) < VIEWPORT_EPSILON &&
    Math.abs(current.y - expected.y) < VIEWPORT_EPSILON &&
    Math.abs(current.zoom - expected.zoom) < VIEWPORT_EPSILON
  );
}

export function isCurrentViewportInitialization(
  initialization: CanvasViewportInitialization,
  currentGeneration: number,
): boolean {
  return initialization.generation === currentGeneration;
}

export function isProgrammaticViewportMove(input: {
  canvasId: string | null;
  initialization: CanvasViewportInitialization | null;
  viewport: CanvasViewport;
}): boolean {
  return (
    input.canvasId !== null &&
    input.initialization?.canvasId === input.canvasId &&
    viewportMatches(input.viewport, input.initialization.viewport)
  );
}

export function scheduleViewportReveal(
  callback: FrameRequestCallback,
  scheduler: AnimationFrameScheduler = window,
): () => void {
  const handle = scheduler.requestAnimationFrame(callback);
  return () => scheduler.cancelAnimationFrame(handle);
}
