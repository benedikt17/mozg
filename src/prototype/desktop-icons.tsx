import React from "react";

export type UiIconName =
  | "arrow-left"
  | "arrow-right"
  | "book"
  | "check"
  | "check-circle"
  | "chevron-down"
  | "chevron-right"
  | "close"
  | "collapse"
  | "expand"
  | "eye"
  | "file"
  | "file-plus"
  | "folder"
  | "folder-open"
  | "folder-plus"
  | "inbox"
  | "layout"
  | "locate"
  | "more"
  | "nodes"
  | "panel-left"
  | "panel-right"
  | "pencil"
  | "pin"
  | "plus"
  | "search"
  | "share"
  | "sort"
  | "split"
  | "text"
  | "trash";

export function UiIcon({ name }: { name: UiIconName }): React.JSX.Element {
  const commonProps = {
    "aria-hidden": true,
    className: "ui-icon",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  } as const;
  const paths: Record<UiIconName, React.ReactNode> = {
    "arrow-left": <path d="M15 18l-6-6 6-6" />,
    "arrow-right": <path d="M9 6l6 6-6 6" />,
    book: (
      <>
        <path d="M5 4h10a4 4 0 0 1 4 4v12H8a3 3 0 0 0-3 3z" />
        <path d="M5 4v16" />
        <path d="M8 8h7" />
      </>
    ),
    check: <path d="M5 12.5l4 4L19 6.5" />,
    "check-circle": (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5" />
      </>
    ),
    "chevron-down": <path d="M7 10l5 5 5-5" />,
    "chevron-right": <path d="M10 7l5 5-5 5" />,
    close: (
      <>
        <path d="M7 7l10 10" />
        <path d="M17 7L7 17" />
      </>
    ),
    collapse: (
      <>
        <path d="M8 7h8" />
        <path d="M8 12h8" />
        <path d="M8 17h8" />
      </>
    ),
    expand: (
      <>
        <path d="M8 7h8" />
        <path d="M8 12h8" />
        <path d="M8 17h8" />
        <path d="M5 9V5h4" />
        <path d="M19 15v4h-4" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    file: (
      <>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5" />
      </>
    ),
    "file-plus": (
      <>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5" />
        <path d="M10 14h5" />
        <path d="M12.5 11.5v5" />
      </>
    ),
    folder: (
      <>
        <path d="M3 6h7l2 2h9v10.5A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5z" />
        <path d="M3 9h18" />
      </>
    ),
    "folder-open": (
      <>
        <path d="M3 7h7l2 2h9" />
        <path d="M4 11h17l-2 8H5z" />
      </>
    ),
    "folder-plus": (
      <>
        <path d="M3 6h7l2 2h9v10.5A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5z" />
        <path d="M10 15h5" />
        <path d="M12.5 12.5v5" />
      </>
    ),
    inbox: (
      <>
        <path d="M4 5h16l-2 10H6z" />
        <path d="M6 15l2 4h8l2-4" />
        <path d="M9 12h6" />
      </>
    ),
    layout: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 10h16" />
        <path d="M10 10v10" />
      </>
    ),
    locate: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
      </>
    ),
    more: (
      <>
        <path d="M6 12h.01" />
        <path d="M12 12h.01" />
        <path d="M18 12h.01" />
      </>
    ),
    nodes: (
      <>
        <circle cx="6" cy="7" r="2.5" />
        <circle cx="18" cy="7" r="2.5" />
        <circle cx="12" cy="17" r="2.5" />
        <path d="M8 8.5l2.5 6" />
        <path d="M16 8.5l-2.5 6" />
      </>
    ),
    "panel-left": (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
        <path d="M15 9l-3 3 3 3" />
      </>
    ),
    "panel-right": (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
        <path d="M12 9l3 3-3 3" />
      </>
    ),
    pencil: (
      <>
        <path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" />
        <path d="M14 7l3 3" />
      </>
    ),
    pin: (
      <>
        <path d="M9 4h6l-1 5 3 3H7l3-3z" />
        <path d="M12 12v8" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="M16 16l4 4" />
      </>
    ),
    share: (
      <>
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="17" cy="6" r="2.5" />
        <circle cx="17" cy="18" r="2.5" />
        <path d="M8.2 10.8l6.6-3.6" />
        <path d="M8.2 13.2l6.6 3.6" />
      </>
    ),
    sort: (
      <>
        <path d="M7 6h10" />
        <path d="M9 12h6" />
        <path d="M11 18h2" />
      </>
    ),
    split: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="1.5" />
        <path d="M12 5v14" />
      </>
    ),
    text: (
      <>
        <path d="M5 5h14" />
        <path d="M12 5v14" />
        <path d="M8 19h8" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M9 7V4h6v3" />
        <path d="M7 7l1 13h8l1-13" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
      </>
    ),
  };
  return <svg {...commonProps}>{paths[name]}</svg>;
}
