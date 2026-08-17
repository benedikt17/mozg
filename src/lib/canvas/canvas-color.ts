export type CanvasHsvColor = {
  hue: number;
  saturation: number;
  value: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function hexByte(value: number): string {
  return Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, "0");
}

export function normalizeCanvasHexColor(value: string): string | null {
  const trimmed = value.trim();
  const short = /^#?([0-9a-f]{3})$/i.exec(trimmed)?.[1];
  if (short) {
    return `#${short
      .split("")
      .map((digit) => `${digit}${digit}`)
      .join("")}`.toLowerCase();
  }

  const full = /^#?([0-9a-f]{6})$/i.exec(trimmed)?.[1];
  return full ? `#${full.toLowerCase()}` : null;
}

export function canvasHexToHsv(value: string): CanvasHsvColor | null {
  const normalized = normalizeCanvasHexColor(value);
  if (!normalized) return null;

  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;

  let hue = 0;
  if (delta > 0) {
    if (maximum === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (maximum === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }
  if (hue < 0) hue += 360;

  return {
    hue,
    saturation: maximum === 0 ? 0 : delta / maximum,
    value: maximum,
  };
}

export function canvasHsvToHex(color: CanvasHsvColor): string {
  const hue = ((color.hue % 360) + 360) % 360;
  const saturation = clamp(color.saturation, 0, 1);
  const value = clamp(color.value, 0, 1);
  const chroma = value * saturation;
  const sector = hue / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const match = value - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;
  if (sector < 1) {
    red = chroma;
    green = second;
  } else if (sector < 2) {
    red = second;
    green = chroma;
  } else if (sector < 3) {
    green = chroma;
    blue = second;
  } else if (sector < 4) {
    green = second;
    blue = chroma;
  } else if (sector < 5) {
    red = second;
    blue = chroma;
  } else {
    red = chroma;
    blue = second;
  }

  return `#${hexByte((red + match) * 255)}${hexByte(
    (green + match) * 255,
  )}${hexByte((blue + match) * 255)}`;
}
