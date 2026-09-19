import { describe, expect, it } from "vitest";
import { parseCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import {
  createCanvasImagePin,
  moveCanvasImagePin,
  removeCanvasImagePin,
  setCanvasImagePinColor,
  setCanvasImagePinLabel,
  setCanvasImagePinRadius,
} from "@/lib/canvas/canvas-image-pins";
import {
  canvasDocumentToImageNodes,
  runtimeNodesToCanvasDocument,
} from "@/lib/canvas/react-flow-canvas-adapter";

describe("Canvas image pins", () => {
  it("keeps pins inside the image and removes only the requested pin", () => {
    const first = createCanvasImagePin([], () => "first");
    expect(first).toEqual({
      id: "image-pin-first",
      x: 0.5,
      y: 0.5,
      color: "red",
      radius: 20,
    });
    const moved = moveCanvasImagePin(
      [first as NonNullable<typeof first>],
      first!.id,
      {
        x: -1,
        y: 2,
      },
    );
    expect(moved).toEqual([
      { id: "image-pin-first", x: 0, y: 1, color: "red", radius: 20 },
    ]);
    expect(removeCanvasImagePin(moved, first!.id)).toEqual([]);
  });

  it("updates the pin color, label, and bounds the radius", () => {
    const pins = [
      { id: "pin-1", x: 0.5, y: 0.5, color: "red" as const, radius: 13 },
    ];
    expect(setCanvasImagePinColor(pins, "pin-1", "green")).toMatchObject([
      { color: "green" },
    ]);
    expect(setCanvasImagePinRadius(pins, "pin-1", 999)).toMatchObject([
      { radius: 32 },
    ]);
    expect(setCanvasImagePinLabel(pins, "pin-1", "42")).toMatchObject([
      { label: "42" },
    ]);
    expect(
      setCanvasImagePinLabel(pins, "pin-1", undefined)[0],
    ).not.toHaveProperty("label");
  });

  it("round-trips pin metadata through the React Flow projection", () => {
    const document = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          id: "image",
          kind: "image",
          fileId: "file-1",
          aspectRatioLocked: true,
          pins: [
            {
              id: "pin-1",
              x: 0.25,
              y: 0.75,
              color: "yellow",
              radius: 18,
              label: "12",
            },
          ],
          position: { x: 100, y: 120 },
          size: { width: 400, height: 200 },
          zIndex: 1,
        },
      ],
      edges: [],
    });
    const runtime = canvasDocumentToImageNodes(document);
    expect(runtime[0].data.pins).toEqual([
      {
        id: "pin-1",
        x: 0.25,
        y: 0.75,
        color: "yellow",
        radius: 18,
        label: "12",
      },
    ]);

    const next = runtimeNodesToCanvasDocument(document, [
      {
        ...runtime[0],
        data: {
          ...runtime[0].data,
          pins: [
            {
              id: "pin-1",
              x: 0.6,
              y: 0.4,
              color: "green",
              radius: 22,
              label: "123",
            },
          ],
        },
      },
    ]);
    expect(next.nodes[0]).toMatchObject({
      pins: [
        {
          id: "pin-1",
          x: 0.6,
          y: 0.4,
          color: "green",
          radius: 22,
          label: "123",
        },
      ],
    });
  });

  it("rejects a pin outside image bounds", () => {
    expect(() =>
      parseCanvasDocumentV2({
        schemaVersion: 2,
        nodes: [
          {
            id: "image",
            kind: "image",
            assetId: "asset-1",
            aspectRatioLocked: true,
            pins: [{ id: "pin-1", x: 1.01, y: 0 }],
            position: { x: 0, y: 0 },
            size: { width: 100, height: 100 },
            zIndex: 1,
          },
        ],
        edges: [],
      }),
    ).toThrow("Image pins must stay inside image bounds");
  });

  it("normalizes old pins and rejects unsupported pin presentation", () => {
    const legacy = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          id: "image",
          kind: "image",
          assetId: "asset-1",
          aspectRatioLocked: true,
          pins: [{ id: "pin-1", x: 0.5, y: 0.5 }],
          position: { x: 0, y: 0 },
          size: { width: 100, height: 100 },
          zIndex: 1,
        },
      ],
      edges: [],
    });
    expect(legacy.nodes[0]).toMatchObject({
      pins: [{ color: "red", radius: 20 }],
    });
    expect(() =>
      parseCanvasDocumentV2({
        schemaVersion: 2,
        nodes: [
          {
            id: "image",
            kind: "image",
            assetId: "asset-1",
            aspectRatioLocked: true,
            pins: [
              { id: "pin-1", x: 0.5, y: 0.5, color: "purple", radius: 13 },
            ],
            position: { x: 0, y: 0 },
            size: { width: 100, height: 100 },
            zIndex: 1,
          },
        ],
        edges: [],
      }),
    ).toThrow("Expected a supported image pin color");
    expect(() =>
      parseCanvasDocumentV2({
        schemaVersion: 2,
        nodes: [
          {
            id: "image",
            kind: "image",
            assetId: "asset-1",
            aspectRatioLocked: true,
            pins: [{ id: "pin-1", x: 0.5, y: 0.5, label: "1234" }],
            position: { x: 0, y: 0 },
            size: { width: 100, height: 100 },
            zIndex: 1,
          },
        ],
        edges: [],
      }),
    ).toThrow("Image pin label must contain from one to three digits");
  });
});
