import {
  CANVAS_IMAGE_PIN_DEFAULT_RADIUS,
  CANVAS_IMAGE_PIN_MAX_RADIUS,
  CANVAS_IMAGE_PIN_MIN_RADIUS,
  type CanvasImagePin,
  type CanvasImagePinColor,
} from "@/lib/canvas/canvas-document";

export const CANVAS_IMAGE_PIN_LIMIT = 200;

export function createCanvasImagePin(
  pins: readonly CanvasImagePin[],
  idGenerator: () => string = () =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
): CanvasImagePin | null {
  if (pins.length >= CANVAS_IMAGE_PIN_LIMIT) return null;
  return {
    id: `image-pin-${idGenerator()}`,
    x: 0.5,
    y: 0.5,
    color: "red",
    radius: CANVAS_IMAGE_PIN_DEFAULT_RADIUS,
  };
}

export function moveCanvasImagePin(
  pins: readonly CanvasImagePin[],
  id: string,
  position: { x: number; y: number },
): CanvasImagePin[] {
  const x = Math.min(1, Math.max(0, position.x));
  const y = Math.min(1, Math.max(0, position.y));
  return pins.map((pin) => (pin.id === id ? { ...pin, x, y } : { ...pin }));
}

export function removeCanvasImagePin(
  pins: readonly CanvasImagePin[],
  id: string,
): CanvasImagePin[] {
  return pins.filter((pin) => pin.id !== id).map((pin) => ({ ...pin }));
}

export function setCanvasImagePinColor(
  pins: readonly CanvasImagePin[],
  id: string,
  color: CanvasImagePinColor,
): CanvasImagePin[] {
  return pins.map((pin) => (pin.id === id ? { ...pin, color } : { ...pin }));
}

export function setCanvasImagePinRadius(
  pins: readonly CanvasImagePin[],
  id: string,
  radius: number,
): CanvasImagePin[] {
  const safeRadius = Math.min(
    CANVAS_IMAGE_PIN_MAX_RADIUS,
    Math.max(CANVAS_IMAGE_PIN_MIN_RADIUS, radius),
  );
  return pins.map((pin) =>
    pin.id === id ? { ...pin, radius: safeRadius } : { ...pin },
  );
}
