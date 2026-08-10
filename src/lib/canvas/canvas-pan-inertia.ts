export type CanvasPanSample = {
  x: number;
  y: number;
  at: number;
};

export type CanvasPanVelocity = {
  x: number;
  y: number;
};

export type CanvasPanViewport = {
  x: number;
  y: number;
  zoom: number;
};

const RELEASE_SAMPLE_WINDOW_MS = 80;
const MIN_RELEASE_SPEED_PX_PER_MS = 0.08;
const MAX_RELEASE_SPEED_PX_PER_MS = 3.2;
const STOP_SPEED_PX_PER_MS = 0.02;
const DECAY_RATE_PER_MS = 0.008;

function magnitude(vector: CanvasPanVelocity): number {
  return Math.hypot(vector.x, vector.y);
}

export function canvasPanReleaseVelocity(
  samples: readonly CanvasPanSample[],
): CanvasPanVelocity | null {
  if (samples.length < 2) return null;
  const latest = samples[samples.length - 1];
  const windowStart = latest.at - RELEASE_SAMPLE_WINDOW_MS;
  let oldest = samples[0];
  for (const sample of samples) {
    if (sample.at >= windowStart) {
      oldest = sample;
      break;
    }
  }
  const elapsed = latest.at - oldest.at;
  if (elapsed <= 0) return null;
  const velocity = {
    x: (latest.x - oldest.x) / elapsed,
    y: (latest.y - oldest.y) / elapsed,
  };
  const speed = magnitude(velocity);
  if (speed < MIN_RELEASE_SPEED_PX_PER_MS) return null;
  if (speed <= MAX_RELEASE_SPEED_PX_PER_MS) return velocity;
  const scale = MAX_RELEASE_SPEED_PX_PER_MS / speed;
  return { x: velocity.x * scale, y: velocity.y * scale };
}

export function advanceCanvasPanInertia({
  viewport,
  velocity,
  elapsedMs,
}: {
  viewport: CanvasPanViewport;
  velocity: CanvasPanVelocity;
  elapsedMs: number;
}): {
  viewport: CanvasPanViewport;
  velocity: CanvasPanVelocity;
  done: boolean;
} {
  const dt = Math.max(0, Math.min(elapsedMs, 40));
  if (dt === 0) return { viewport, velocity, done: false };
  const decay = Math.exp(-DECAY_RATE_PER_MS * dt);
  const nextVelocity = {
    x: velocity.x * decay,
    y: velocity.y * decay,
  };
  const distanceScale = (1 - decay) / DECAY_RATE_PER_MS;
  const nextViewport = {
    x: viewport.x + velocity.x * distanceScale,
    y: viewport.y + velocity.y * distanceScale,
    zoom: viewport.zoom,
  };
  return {
    viewport: nextViewport,
    velocity: nextVelocity,
    done: magnitude(nextVelocity) <= STOP_SPEED_PX_PER_MS,
  };
}
