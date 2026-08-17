"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  canvasHexToHsv,
  canvasHsvToHex,
  normalizeCanvasHexColor,
  type CanvasHsvColor,
} from "@/lib/canvas/canvas-color";
import styles from "./canvas-color-picker.module.css";

const FALLBACK_COLOR = "#ffffff";

function fallbackHsv(): CanvasHsvColor {
  return { hue: 0, saturation: 0, value: 1 };
}

function hsvForHex(value: string): CanvasHsvColor {
  return canvasHexToHsv(value) ?? fallbackHsv();
}

function displayHex(value: string): string {
  return value.toUpperCase();
}

export function CanvasColorPicker({
  value,
  label,
  glyph,
  onCommit,
}: {
  value: string;
  label: string;
  glyph: string;
  onCommit: (value: string) => void;
}): React.JSX.Element {
  const normalizedValue = normalizeCanvasHexColor(value) ?? FALLBACK_COLOR;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeSvPointerRef = useRef<number | null>(null);
  const lastCommittedRef = useRef(normalizedValue);
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<CanvasHsvColor>(() =>
    hsvForHex(normalizedValue),
  );
  const [draftHex, setDraftHex] = useState(() => displayHex(normalizedValue));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const closeOnKeyboard = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    document.addEventListener("keydown", closeOnKeyboard, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("keydown", closeOnKeyboard, true);
    };
  }, [open]);

  const setDraftHsv = (next: CanvasHsvColor): void => {
    setHsv(next);
    setDraftHex(displayHex(canvasHsvToHex(next)));
  };

  const commitHsv = (next: CanvasHsvColor): void => {
    const nextHex = canvasHsvToHex(next);
    setHsv(next);
    setDraftHex(displayHex(nextHex));
    if (nextHex === lastCommittedRef.current) return;
    lastCommittedRef.current = nextHex;
    onCommit(nextHex);
  };

  const hsvFromPointer = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): CanvasHsvColor => {
    const rect = event.currentTarget.getBoundingClientRect();
    const saturation = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)),
    );
    const value =
      1 -
      Math.max(
        0,
        Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)),
      );
    return { ...hsv, saturation, value };
  };

  const commitHexDraft = (): void => {
    const normalized = normalizeCanvasHexColor(draftHex);
    if (!normalized) {
      setHsv(hsvForHex(lastCommittedRef.current));
      setDraftHex(displayHex(lastCommittedRef.current));
      return;
    }
    const nextHsv = hsvForHex(normalized);
    setHsv(nextHsv);
    setDraftHex(displayHex(normalized));
    if (normalized === lastCommittedRef.current) return;
    lastCommittedRef.current = normalized;
    onCommit(normalized);
  };

  const commitHueFromKeyboard = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ): void => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown" &&
      event.key !== "Home" &&
      event.key !== "End"
    )
      return;
    commitHsv({ ...hsv, hue: Number(event.currentTarget.value) });
  };

  const swatchColor = open
    ? (normalizeCanvasHexColor(draftHex) ?? normalizedValue)
    : normalizedValue;

  const toggleOpen = (): void => {
    if (!open) {
      lastCommittedRef.current = normalizedValue;
      setHsv(hsvForHex(normalizedValue));
      setDraftHex(displayHex(normalizedValue));
    }
    setOpen((current) => !current);
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.root} nodrag nopan nowheel`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={label}
        onClick={toggleOpen}
      >
        <span className={styles.glyph}>{glyph}</span>
        <span
          className={styles.swatch}
          style={{ backgroundColor: swatchColor }}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          className={styles.panel}
          role="dialog"
          aria-label={`${label}: выбор цвета`}
          onClick={(event) => event.stopPropagation()}
        >
          <p className={styles.title}>{label}</p>
          <div
            className={styles.svArea}
            aria-label={`${label}: насыщенность и яркость`}
            style={
              {
                "--picker-hue": hsv.hue,
              } as CSSProperties
            }
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              activeSvPointerRef.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              setDraftHsv(hsvFromPointer(event));
            }}
            onPointerMove={(event) => {
              if (activeSvPointerRef.current !== event.pointerId) return;
              setDraftHsv(hsvFromPointer(event));
            }}
            onPointerUp={(event) => {
              if (activeSvPointerRef.current !== event.pointerId) return;
              const next = hsvFromPointer(event);
              activeSvPointerRef.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
              commitHsv(next);
            }}
            onPointerCancel={(event) => {
              if (activeSvPointerRef.current !== event.pointerId) return;
              activeSvPointerRef.current = null;
              setHsv(hsvForHex(lastCommittedRef.current));
              setDraftHex(displayHex(lastCommittedRef.current));
            }}
          >
            <span
              className={styles.svCursor}
              style={{
                left: `${hsv.saturation * 100}%`,
                top: `${(1 - hsv.value) * 100}%`,
              }}
              aria-hidden="true"
            />
          </div>
          <input
            className={styles.hueSlider}
            type="range"
            min="0"
            max="359"
            step="1"
            value={Math.round(hsv.hue)}
            aria-label={`${label}: оттенок`}
            onChange={(event) =>
              setDraftHsv({ ...hsv, hue: Number(event.target.value) })
            }
            onPointerUp={(event) =>
              commitHsv({ ...hsv, hue: Number(event.currentTarget.value) })
            }
            onKeyUp={commitHueFromKeyboard}
            onBlur={(event) =>
              commitHsv({ ...hsv, hue: Number(event.currentTarget.value) })
            }
          />
          <div className={styles.hexRow}>
            <span className={styles.hexLabel}>HEX</span>
            <input
              className={styles.hexInput}
              value={draftHex}
              maxLength={7}
              spellCheck={false}
              aria-label={`${label}: HEX`}
              onChange={(event) => setDraftHex(event.target.value)}
              onBlur={commitHexDraft}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                commitHexDraft();
                event.currentTarget.select();
              }}
            />
            <span
              className={styles.preview}
              style={{ backgroundColor: swatchColor }}
              aria-hidden="true"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
