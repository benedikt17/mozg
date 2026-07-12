import * as React from "react";
import { cn } from "@/lib/utils";

type PrototypeButtonVariant = "default" | "primary" | "ghost" | "quiet";
type PrototypeButtonSize = "compact" | "standard" | "icon";

export type PrototypeButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean;
    variant?: PrototypeButtonVariant;
    size?: PrototypeButtonSize;
  };

export function PrototypeButton({
  active = false,
  className,
  size = "standard",
  variant = "default",
  ...props
}: PrototypeButtonProps): React.JSX.Element {
  return (
    <button
      className={cn(
        "ui-button",
        `ui-button-${variant}`,
        `ui-button-${size}`,
        active && "is-active",
        className,
      )}
      type="button"
      {...props}
    />
  );
}

export type IconButtonProps = Omit<
  PrototypeButtonProps,
  "children" | "size"
> & {
  label: string;
  icon: React.ReactNode;
};

export function IconButton({
  icon,
  label,
  ...props
}: IconButtonProps): React.JSX.Element {
  return (
    <PrototypeButton aria-label={label} size="icon" {...props}>
      {icon}
    </PrototypeButton>
  );
}

export function MetadataLine({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return <p className={cn("metadata-line", className)}>{children}</p>;
}

export function WorkspaceHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <header className="workspace-header">
      <div>
        {eyebrow ? <span className="ui-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <MetadataLine>{description}</MetadataLine> : null}
      </div>
      {actions ? (
        <div className="workspace-header-actions">{actions}</div>
      ) : null}
    </header>
  );
}

export function ToolSidebarItem({
  active,
  children,
  className,
  ...props
}: PrototypeButtonProps): React.JSX.Element {
  return (
    <PrototypeButton
      active={active}
      className={cn("tool-sidebar-item", className)}
      variant="ghost"
      {...props}
    >
      {children}
    </PrototypeButton>
  );
}

export function ContextPanelSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="context-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
